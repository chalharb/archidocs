#!/usr/bin/env node
// Builds the Big Bank plc demo site with a realistic history.
//
// The Workspace in `archidocs/` is the model as it stands today. This script
// replays how it got there as four dated commits in a throwaway git repo
// (launch, identity, payments, views), checks each one, then runs
// `archidocs build --out` there, so the site's timeline and Compare have real
// Revisions to show.
//
// Usage: node examples/big-bank/build-demo.mjs [out-dir]   (default: examples/big-bank/site)

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const cli = resolve(here, "../../src/cli/main.ts");
const out = resolve(process.argv[2] ?? join(here, "site"));

// The build replaces `out`, so a mistyped path must not cost a folder. It is normalized and must sit in this repo or the
// temp folder (a throw, not process.exit, so every use below is guarded), and only a missing or empty folder, or an
// earlier site, is cleared.
const temp = resolve(tmpdir());
const base = out.startsWith(temp + sep) ? temp : resolve(here, "../..");
if (!out.startsWith(base + sep)) throw new Error(`${out} is outside this repo and the temp folder, so the demo will not build there.`);
if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, "workspace.bundle.json"))) {
  throw new Error(`${out} is not empty and is not an archidocs site, so the demo will not replace it. Pass an empty or new folder.`);
}

/** Each stage starts from today's model, drops what didn't exist yet, then lays older files over it. */
const stages = [
  {
    date: "2025-03-14T10:00:00Z",
    message: "Model internet banking and the mainframe",
    drop: ["identity", "payments", "digital/views.yaml", "digital/adr/0002-delegate-sign-in-to-the-identity-platform.md"],
    overlays: ["1-launch"],
  },
  {
    date: "2025-07-21T10:00:00Z",
    message: "Delegate sign-in to the Identity Platform",
    drop: ["payments", "digital/views.yaml"],
    overlays: ["1-launch", "2-identity"],
  },
  {
    date: "2025-11-03T10:00:00Z",
    message: "Add Payments and the Event Bus",
    drop: ["digital/views.yaml", "payments/views.yaml", "payments/adr/0002-hold-payments-on-a-high-fraud-score.md"],
    overlays: [],
  },
  {
    date: "2026-03-02T10:00:00Z",
    message: "Add Saved and Dynamic Views; propose holding high-risk payments",
    drop: [],
    overlays: [],
  },
];

const repo = mkdtempSync(join(tmpdir(), "archidocs-big-bank-"));
const workspace = join(repo, "archidocs");
const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: repo, stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, ...env } }).toString();

run("git", ["init", "--quiet", "--initial-branch=main"]);
for (const stage of stages) {
  rmSync(workspace, { recursive: true, force: true });
  cpSync(join(here, "archidocs"), workspace, { recursive: true });
  for (const path of stage.drop) rmSync(join(workspace, path), { recursive: true, force: true });
  for (const overlay of stage.overlays) cpSync(join(here, "history", overlay), workspace, { recursive: true });

  try {
    run(process.execPath, [cli, "check"]);
  } catch (error) {
    process.stdout.write(error.stdout?.toString() ?? "");
    throw new Error(`Stage "${stage.message}" has check errors.`, { cause: error });
  }
  const env = {
    GIT_AUTHOR_NAME: "Big Bank Architecture",
    GIT_AUTHOR_EMAIL: "architecture@bigbank.example",
    GIT_COMMITTER_NAME: "Big Bank Architecture",
    GIT_COMMITTER_EMAIL: "architecture@bigbank.example",
    GIT_AUTHOR_DATE: stage.date,
    GIT_COMMITTER_DATE: stage.date,
  };
  run("git", ["add", "--all"], env);
  run("git", ["commit", "--quiet", "-m", stage.message], env);
}
run("git", ["tag", "v1.0", "HEAD~1"]);

rmSync(out, { recursive: true, force: true });
run(process.execPath, [cli, "build", "--out", out]);
rmSync(repo, { recursive: true, force: true });
process.stdout.write(`Built the Big Bank demo site in ${out}\n`);
