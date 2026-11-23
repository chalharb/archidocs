/**
 * Writes a fixture Workspace repo for CI to run the Archidocs Action against.
 *
 *   node scripts/fixture-workspace.ts <dir> [--broken | --pr]
 *
 * `main` gets three Revisions (the second tagged v1) and a Saved View. With
 * `--broken` the last commit has an unknown Team, so `check` fails. With
 * `--pr` the checkout ends on branch `pr`, one Revision past `main`, with
 * `origin/main` set as a fetch would leave it.
 */
import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { historyAfter, historyBefore, viewerWorkspace } from "../test/support/fixtures.ts";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { broken: { type: "boolean" }, pr: { type: "boolean" } } });
if (positionals.length !== 1) throw new Error("Usage: node scripts/fixture-workspace.ts <dir> [--broken | --pr]");
const repo = resolve(positionals[0]!);
await rm(repo, { recursive: true, force: true });
await mkdir(repo, { recursive: true });

const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
git("init", "--quiet", "--initial-branch=main");

/** Commits files under `archidocs/` (`null` deletes one) with a fixed date, so the history is the same on every run. */
async function commit(subject: string, date: string, files: Record<string, string | null>) {
  for (const [path, text] of Object.entries(files)) {
    const full = join(repo, "archidocs", path);
    if (text === null) await rm(full);
    else {
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, text);
    }
  }
  git("add", "--all");
  execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "--quiet", "-m", subject], {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

const views = "views:\n  structural:\n    overview:\n      title: Shop overview\n      level: c2\n";
await commit("First model", "2026-01-10T12:00:00Z", { ...viewerWorkspace, "shop/views.yaml": views });
await commit("Add the Legacy shop", "2026-02-10T12:00:00Z", historyBefore);
git("tag", "v1");
await commit("Add Wishlist, rename Web, retire Legacy", "2026-03-10T12:00:00Z", { ...historyAfter, "shop/legacy.yaml": null });
if (values.broken) await commit("Give Wishlist an unknown owner", "2026-03-20T12:00:00Z", { "shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n    owner: nobody\n" });
if (values.pr) {
  git("update-ref", "refs/remotes/origin/main", "main");
  git("checkout", "--quiet", "-b", "pr");
  await commit("Add Gift cards", "2026-04-01T12:00:00Z", { "shop/gift-cards.yaml": "services:\n  gift-cards:\n    name: Gift cards\n" });
}
console.log(`Wrote the fixture Workspace repo to ${repo}`);
