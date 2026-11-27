/**
 * Checks the Model write tools (the YAML writer behind the MCP server's
 * upsert_*, remove_* and propose_adr tools) against two concurrent callers,
 * over every schedule of their file-system calls with at most `--bound`
 * preemptions (default 2). It runs the real `write()`; only the file system
 * is in memory. See .claude/skills/concurrent-model-writes/SKILL.md.
 *
 *   node scripts/formal/concurrent-writes.ts [--bound N] [--scenario name] [--all]
 *
 * --all keeps exploring past the first failing schedule and counts them.
 *
 * Exits 0 when every property holds in every scenario, 1 otherwise.
 */
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadDetailed } from "../../src/core/load.ts";
import { write, type WriteRequest, type WriteResult } from "../../src/writer/index.ts";
import { explore, type Files, type Run, type Task } from "./schedule.ts";

const ROOT = "/ws";

const workspace = `teams:
  shop-team:
    name: Shop
environments:
  prod:
    name: Production
`;
const project = `id: shop
name: Shop
owner: shop-team
`;

interface Scenario {
  name: string;
  /** The harm if the property breaks here, in one plain sentence. */
  harm: string;
  files: Record<string, string>;
  writes: [WriteRequest, WriteRequest];
}

const scenarios: Scenario[] = [
  {
    name: "remove-while-referenced",
    harm: "An agent removes the DB Service while another adds a Relationship to it; both succeed and the Workspace is left with a Relationship to nothing, so `archidocs check` fails on main.",
    files: {
      "workspace.yaml": workspace,
      "shop/project.yaml": project,
      "shop/web.yaml": "services:\n  web:\n    name: Web\n",
      "shop/db.yaml": "services:\n  db:\n    name: DB\n",
    },
    writes: [
      { op: "remove-element", project: "shop", id: "db" },
      { op: "upsert-relationship", project: "shop", from: "web", to: "db", fields: { description: "Reads from" } },
    ],
  },
  {
    name: "two-adds-one-file",
    harm: "Two agents each add a Service to shop/model.yaml; both are told `created`, but the second file write replaces the first, so one Service silently disappears.",
    files: {
      "workspace.yaml": workspace,
      "shop/project.yaml": project,
      "shop/model.yaml": "services:\n  web:\n    name: Web\n",
    },
    writes: [
      { op: "upsert-element", project: "shop", kind: "service", id: "cart", fields: { name: "Cart" } },
      { op: "upsert-element", project: "shop", kind: "service", id: "search", fields: { name: "Search" } },
    ],
  },
  {
    name: "two-adrs-one-project",
    harm: "Two agents each propose an ADR in the shop Project; both take number 0001, so `archidocs check` fails with duplicate-adr-number.",
    files: {
      "workspace.yaml": workspace,
      "shop/project.yaml": project,
      "shop/model.yaml": "services:\n  web:\n    name: Web\n",
    },
    writes: [
      { op: "propose-adr", project: "shop", title: "Use Postgres for carts", body: "Carts move to Postgres." },
      { op: "propose-adr", project: "shop", title: "Cache search results", body: "Search results are cached." },
    ],
  },
];

type Outcome = WriteResult | { thrown: string };

/** What a caller sees of a result: enough to tell one sequential order from another, without the diff text. */
const seen = (r: Outcome) => ("thrown" in r ? `threw ${r.thrown}` : r.ok ? `${r.action} ${JSON.stringify(r.subject)}` : `refused ${r.code}`);
const filesKey = (files: Files) => JSON.stringify([...files].sort(([a], [b]) => (a < b ? -1 : 1)));
const runKey = (run: Run<Outcome>) => `${run.results.map(seen).join(" | ")}\n${filesKey(run.files)}`;

async function errorsIn(files: Files): Promise<string[]> {
  const store = files;
  const fs = {
    readFile: async (p: string) => store.get(p)!,
    exists: async (p: string) => store.has(p) || [...store.keys()].some((k) => k.startsWith(p + "/")),
    readDir: async (p: string) => {
      const names = new Map<string, boolean>();
      for (const k of store.keys()) {
        if (!k.startsWith(p + "/")) continue;
        const rest = k.slice(p.length + 1).split("/");
        names.set(rest[0]!, rest.length > 1);
      }
      return [...names].map(([name, isDirectory]) => ({ name, isDirectory }));
    },
  };
  const { issues } = await loadDetailed({ fs, root: ROOT, repoRoot: ROOT });
  return issues.filter((i) => i.severity === "error").map((i) => `${i.file}:${i.line} ${i.rule}: ${i.message}`);
}

function trace(run: Run<Outcome>): string {
  const lines: string[] = [];
  let last = "";
  for (const s of run.steps) {
    const what = `${s.op} ${s.path.slice(ROOT.length + 1) || "."}`;
    if (s.task !== last) lines.push(`  ${s.task}:`);
    if (lines.at(-1)?.endsWith(what)) continue;
    lines.push(`    ${what}`);
    last = s.task;
  }
  return lines.join("\n");
}

async function check(scenario: Scenario, bound: number, all: boolean): Promise<boolean> {
  const start: Files = new Map(Object.entries(scenario.files).map(([p, t]) => [join(ROOT, p), t]));
  if ((await errorsIn(start)).length > 0) throw new Error(`${scenario.name}: the starting Workspace has errors`);
  const tasks: Task<Outcome>[] = scenario.writes.map((request, i) => ({
    name: `writer ${i + 1} (${request.op})`,
    run: (fs) => write({ fs, root: ROOT, repoRoot: ROOT }, request),
  }));

  // The one-at-a-time outcomes: each order of the writes, run with no preemption.
  const serial = new Set<string>();
  for (const order of [tasks, [...tasks].reverse()]) {
    await explore(start, order, 0, (run) => {
      const results = order === tasks ? run.results : [...run.results].reverse();
      serial.add(runKey({ ...run, results }));
      return false;
    });
  }

  // Both start orders: a task that queues behind another (a lock) is only
  // ever second, so the order the calls arrive in is explored too.
  let failure: { property: string; detail: string; run: Run<Outcome> } | undefined;
  let failing = 0;
  let count = 0;
  for (const reversed of [false, true]) {
    if (failure && !all) break;
    const order = reversed ? [...tasks].reverse() : tasks;
    count += await explore(start, order, bound, async (raw) => {
      const run = reversed ? { ...raw, results: [...raw.results].reverse() } : raw;
      const errors = await errorsIn(run.files);
      const broken = errors.length > 0
        ? { property: "VALID: the Workspace has no errors after both writes", detail: errors.join("\n    "), run }
        : !serial.has(runKey(run))
          ? { property: "SERIAL: the results and files match running the two writes one at a time, in some order", detail: "no one-at-a-time order gives these results and files", run }
          : undefined;
      if (!broken) return true;
      failing++;
      failure ??= broken;
      return all;
    });
  }

  if (!failure) {
    console.log(`PASS ${scenario.name}: ${count} schedules, ≤${bound} preemptions`);
    return true;
  }
  const { property, detail, run } = failure;
  const tally = all ? `${failing} of ${count} schedules break it` : `after ${count} schedules`;
  console.log(`FAIL ${scenario.name}: ${tally}, ≤${bound} preemptions (first shown has ${run.preemptions} preemption${run.preemptions === 1 ? "" : "s"})`);
  console.log(`  broken: ${property}`);
  console.log(`  harm:   ${scenario.harm}`);
  console.log(`  results: ${run.results.map(seen).join(" | ")}`);
  console.log(`  found:   ${detail}`);
  console.log(`  schedule (file-system calls in order; repeats folded):\n${trace(run)}`);
  return false;
}

const { values } = parseArgs({ options: { bound: { type: "string", default: "2" }, scenario: { type: "string" }, all: { type: "boolean", default: false } } });
const bound = Number(values.bound);
const chosen = scenarios.filter((s) => values.scenario === undefined || s.name === values.scenario);
if (chosen.length === 0) throw new Error(`No scenario "${values.scenario}"; have ${scenarios.map((s) => s.name).join(", ")}`);
let ok = true;
for (const s of chosen) ok = (await check(s, bound, values.all)) && ok;
process.exit(ok ? 0 : 1);
