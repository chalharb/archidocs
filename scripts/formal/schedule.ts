import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, sep } from "node:path";
import type { DirEntry, WritableFileSystem } from "../../src/core/fs.ts";

/**
 * A bounded systematic scheduler for the real writer code. Every call a task
 * makes into the file system pauses until the scheduler lets it through, so
 * the only places tasks can interleave are the file-system calls, exactly as
 * with `node:fs/promises` under one Node event loop. `explore` runs every
 * schedule of the given tasks with at most `bound` preemptions (switching
 * away from a task that could have kept going), each from a fresh copy of
 * the starting files.
 */

export type Files = Map<string, string>;

export interface Task<R> {
  name: string;
  run: (fs: WritableFileSystem) => Promise<R>;
}

/** One file-system call a task made: what the scheduler picks between. */
export interface Step {
  task: string;
  op: "readFile" | "readDir" | "exists" | "writeFile";
  path: string;
}

export interface Run<R> {
  results: (R | { thrown: string })[];
  files: Files;
  steps: Step[];
  preemptions: number;
}

interface Pending {
  step: Step;
  go: () => void;
}

interface Decision {
  enabled: number[];
  chosen: number;
  last: number | undefined;
  preemptions: number;
}

const current = new AsyncLocalStorage<number>();

/** A file system over `files` whose every call waits its turn, attributed to the calling task. */
function scheduledFs(files: Files, names: string[], pending: Map<number, Pending>): WritableFileSystem {
  const call = <T>(op: Step["op"], path: string, act: () => T): Promise<T> => {
    const task = current.getStore();
    if (task === undefined) return Promise.resolve(act());
    return new Promise<T>((resolve, reject) => {
      if (pending.has(task)) throw new Error(`${names[task]} made two file-system calls at once; the scheduler assumes one per task`);
      pending.set(task, {
        step: { task: names[task]!, op, path },
        go: () => {
          try {
            resolve(act());
          } catch (error) {
            reject(error);
          }
        },
      });
    });
  };
  const isDir = (path: string) => [...files.keys()].some((p) => p.startsWith(path + sep));
  return {
    readFile: (path) =>
      call("readFile", path, () => {
        const text = files.get(path);
        if (text === undefined) throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
        return text;
      }),
    exists: (path) => call("exists", path, () => files.has(path) || isDir(path)),
    readDir: (path) =>
      call("readDir", path, () => {
        const entries = new Map<string, DirEntry>();
        for (const file of files.keys()) {
          if (!file.startsWith(path + sep)) continue;
          const [name, ...more] = file.slice(path.length + 1).split(sep);
          entries.set(name!, { name: name!, isDirectory: more.length > 0 || dirname(file) !== path });
        }
        return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
      }),
    writeFile: (path, text) => call("writeFile", path, () => void files.set(path, text)),
  };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Runs the tasks once, following `prefix` (task indices) at the first decisions and then the default: keep running the last task while it can. */
async function runOnce<R>(start: Files, tasks: Task<R>[], prefix: number[]): Promise<{ run: Run<R>; decisions: Decision[] }> {
  const files: Files = new Map(start);
  const names = tasks.map((t) => t.name);
  const pending = new Map<number, Pending>();
  const fs = scheduledFs(files, names, pending);
  const done = new Array<boolean>(tasks.length).fill(false);
  const results: Run<R>["results"] = new Array(tasks.length);
  tasks.forEach((t, i) =>
    current.run(i, () =>
      t
        .run(fs)
        .then(
          (r) => void (results[i] = r),
          (e: unknown) => void (results[i] = { thrown: e instanceof Error ? e.message : String(e) }),
        )
        .finally(() => void (done[i] = true)),
    ),
  );

  const decisions: Decision[] = [];
  const steps: Step[] = [];
  let last: number | undefined;
  let preemptions = 0;
  for (;;) {
    // Let every task run until it is finished, waiting on the file system, or
    // waiting on another task (a lock): nothing changes for a few turns of the loop.
    const state = () => `${[...pending.keys()].sort()}/${done}`;
    for (let stable = 0, was = state(); stable < 3; ) {
      await tick();
      const now = state();
      stable = now === was ? stable + 1 : 0;
      was = now;
    }
    const enabled = [...pending.keys()].sort((a, b) => a - b);
    if (enabled.length === 0) {
      if (done.every(Boolean)) break;
      throw new Error(`stuck: ${names.filter((_, i) => !done[i]).join(", ")} waiting on neither the file system nor a running task`);
    }
    const chosen = prefix[decisions.length] ?? (last !== undefined && pending.has(last) ? last : enabled[0]!);
    if (!pending.has(chosen)) throw new Error(`replay diverged at decision ${decisions.length}`);
    if (last !== undefined && pending.has(last) && chosen !== last) preemptions++;
    decisions.push({ enabled, chosen, last, preemptions });
    const p = pending.get(chosen)!;
    pending.delete(chosen);
    steps.push(p.step);
    last = chosen;
    p.go();
  }
  return { run: { results, files, steps, preemptions }, decisions };
}

/**
 * Every schedule of `tasks` from `start` with at most `bound` preemptions,
 * each passed to `visit`; stops early when `visit` returns false.
 */
export async function explore<R>(start: Files, tasks: Task<R>[], bound: number, visit: (run: Run<R>) => boolean | Promise<boolean>): Promise<number> {
  let count = 0;
  const go = async (prefix: number[]): Promise<boolean> => {
    const { run, decisions } = await runOnce(start, tasks, prefix);
    count++;
    if (!(await visit(run))) return false;
    for (let i = decisions.length - 1; i >= prefix.length; i--) {
      const d = decisions[i]!;
      const before = i === 0 ? 0 : decisions[i - 1]!.preemptions;
      for (const alt of d.enabled) {
        if (alt === d.chosen) continue;
        const cost = before + (d.last !== undefined && d.enabled.includes(d.last) && alt !== d.last ? 1 : 0);
        if (cost > bound) continue;
        if (!(await go([...decisions.slice(0, i).map((x) => x.chosen), alt]))) return false;
      }
    }
    return true;
  };
  await go([]);
  return count;
}
