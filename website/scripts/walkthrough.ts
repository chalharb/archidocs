/**
 * Runs a page end to end, as a reader would: every shell block on the page
 * in order, with every file the page shows written where it says, in a temp
 * folder. The `archidocs` it runs is this repo's CLI, so the viewer must be
 * built first (`pnpm build:viewer`).
 *
 * A run fails when a command fails, or when the files the page shows don't
 * add up to the finished Workspace in the page's folder in `examples/`. The
 * tutorial (`tutorial.ts`) and the quick start (`quick-start.ts`) each add
 * their own checks of what the reader ends with.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoPath } from "../src/lib/repo.ts";
import { extractRegion, readSample, sampleRef } from "../src/lib/samples.ts";

export interface Walkthrough {
  /** What messages call the page: "tutorial", "quick start". */
  name: string;
  /** The page, relative to the repo root. */
  page: string;
  /** The finished repo the page's files add up to, such as `examples/tutorial/`. */
  example: string;
  /** Lines a reader runs but the test can't, such as installing from npm or the dev server. Each must still be on the page. */
  skipped: readonly RegExp[];
  /** Shell lines run before the page's, for what the page assumes: the quick start begins in an empty repo. */
  before?: readonly string[];
}

export interface PageScript {
  script: string;
  /** Files the page shows, in order, by their path in the repo the reader builds. */
  files: string[];
}

export interface Fence {
  lang: string;
  meta: string;
  body: string;
}

const SHELL = new Set(["sh", "bash", "shell"]);
const EOF = "ARCHIDOCS_PAGE_EOF";

/** Every code fence that starts at the left margin of a Markdown document, in order. */
export function fences(markdown: string): Fence[] {
  return [...markdown.matchAll(/^(`{3,}|~{3,})(\S*)([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)].map(([, , lang = "", meta = "", body = ""]) => ({ lang, meta, body }));
}

/** The commands in a shell fence: continuation lines joined, blank lines and comments dropped. Not a shell fence: none. */
export function shellLines(fence: Fence): string[] {
  if (!SHELL.has(fence.lang)) return [];
  return fence.body
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.replace(NPX_ARCHIDOCS, "archidocs "));
}

/** `npx archidocs …`, as a page may run it: the walkthrough runs this repo's CLI in its place. */
const NPX_ARCHIDOCS = /^npx\s+(?:(?:-y|--yes)\s+)?archidocs(?:@\S+)?\s+/;

/** The page as one shell script: its shell blocks, and a heredoc for each file it shows. */
export function pageScript(page: string, { name, example, skipped, before = [] }: Walkthrough): PageScript {
  const lines = ["set -eu", ...before];
  const written = new Set<string>();
  const used = new Set<RegExp>();
  for (const fence of fences(page)) {
    const ref = sampleRef(fence.meta);
    if (ref) {
      if (!ref.file.startsWith(example)) continue;
      const path = ref.file.slice(example.length);
      const { text } = readSample(ref);
      const append = ref.region !== undefined && written.has(path);
      lines.push(`mkdir -p "$(dirname ${path})"`, append ? `{ echo; cat; } >> ${path} <<'${EOF}'` : `cat > ${path} <<'${EOF}'`, text, EOF);
      written.add(path);
    } else {
      for (const line of shellLines(fence)) {
        const skip = skipped.find((re) => re.test(line));
        if (skip) used.add(skip);
        else lines.push(line);
      }
    }
  }
  const unused = skipped.filter((re) => !used.has(re));
  if (unused.length > 0) throw new Error(`The ${name} no longer has a line matching ${unused.join(", ")}; drop it from the skipped lines.`);
  return { script: `${lines.join("\n")}\n`, files: [...written] };
}

/** The files of the finished repo in `example`, by their path in it, without region markers. */
export function finishedRepo(example: string): Map<string, string> {
  const root = repoPath(example);
  const files = new Map<string, string>();
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    files.set(file, extractRegion(readFileSync(join(root, file), "utf8"))!);
  }
  return files;
}

export interface Finished {
  /** The repo the reader ends in. */
  repo: string;
  /** A folder beside the repo, for what a check writes. */
  tmp: string;
  /** Files the page shows, in order, by their path in the repo. */
  files: string[];
  /** Runs this repo's CLI in the reader's repo and returns what it prints. */
  archidocs: (...args: string[]) => string;
}

/** Runs the page, checks its files against the finished repo, then runs `verify` on what the reader ends with. */
export function runWalkthrough(walkthrough: Walkthrough, { keep = false, verify }: { keep?: boolean; verify?: (finished: Finished) => void } = {}): void {
  const { name, example } = walkthrough;
  if (!existsSync(repoPath("dist/viewer/index.html"))) throw new Error("The viewer is not built; run `pnpm build:viewer` first.");
  const { script, files } = pageScript(readFileSync(repoPath(walkthrough.page), "utf8"), walkthrough);
  const tmp = mkdtempSync(join(tmpdir(), `archidocs-${name.replace(/\s+/g, "-")}-`));
  try {
    // `archidocs` on the PATH is this repo's CLI.
    const bin = join(tmp, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "archidocs"), `#!/bin/sh\nexec "${process.execPath}" "${repoPath("src/cli/main.ts")}" "$@"\n`);
    chmodSync(join(bin, "archidocs"), 0o755);
    const home = join(tmp, "home");
    mkdirSync(home);
    const done = join(tmp, "repo-path");
    writeFileSync(join(tmp, "page.sh"), `${script}pwd > "${done}"\n`);
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env["PATH"] ?? ""}`,
      HOME: home,
      GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
      GIT_AUTHOR_NAME: "Reader",
      GIT_AUTHOR_EMAIL: "reader@example.com",
      GIT_COMMITTER_NAME: "Reader",
      GIT_COMMITTER_EMAIL: "reader@example.com",
    };
    execFileSync("bash", [join(tmp, "page.sh")], { cwd: home, stdio: "inherit", env });
    const repo = readFileSync(done, "utf8").trim();

    // The files the page shows add up to the finished Workspace, so a reader who follows it ends where the example does.
    const finished = finishedRepo(example);
    const missing = [...finished.keys()].filter((f) => !files.includes(f));
    if (missing.length > 0) throw new Error(`The ${name} never shows ${missing.join(", ")}, which ${example} has.`);
    for (const [path, text] of finished) {
      if (readFileSync(join(repo, path), "utf8").trimEnd() !== text.trimEnd()) throw new Error(`${path} as the ${name} builds it differs from ${example}${path}.`);
    }

    verify?.({ repo, tmp, files, archidocs: (...args) => execFileSync(join(bin, "archidocs"), args, { cwd: repo, encoding: "utf8", env }) });
    console.log(`The ${name} ran end to end in ${repo}.`);
  } finally {
    if (keep) console.log(`Kept ${tmp}.`);
    else rmSync(tmp, { recursive: true, force: true });
  }
}
