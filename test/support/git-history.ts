import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeWorkspace, type Files } from "./workspace.ts";

/** Changes to a repo's files by path from the repo root; `null` deletes the file. */
export type RepoChanges = Record<string, string | null>;

/** Prefixes each Workspace file path with `archidocs/`, the default Workspace root. */
export const inWorkspace = (files: Files): RepoChanges => Object.fromEntries(Object.entries(files).map(([path, text]) => [`archidocs/${path}`, text]));

/**
 * A temp git repo on branch `main` with scripted commits. Each commit takes
 * file changes, a subject and a date, which becomes both author and
 * committer date so history is deterministic.
 */
export async function scriptedRepo() {
  const { repoRoot } = await writeWorkspace({});
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  git("symbolic-ref", "HEAD", "refs/heads/main");
  const stage = async (changes: RepoChanges) => {
    for (const [path, text] of Object.entries(changes)) {
      const full = join(repoRoot, path);
      if (text === null) await rm(full);
      else {
        await mkdir(dirname(full), { recursive: true });
        await writeFile(full, text);
      }
    }
    execFileSync("git", ["add", "--all"], { cwd: repoRoot });
  };
  return {
    repoRoot,
    git,
    async commit(subject: string, date: string, changes: RepoChanges): Promise<string> {
      await stage(changes);
      execFileSync("git", ["-c", "user.name=Ana Author", "-c", "user.email=ana@example.com", "commit", "--quiet", "--allow-empty", "-m", subject], {
        cwd: repoRoot,
        env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
      });
      return git("rev-parse", "HEAD");
    },
    /**
     * Like `commit`, but the commit's sha starts with `prefix` (a few hex
     * characters): a nonce in the message is varied until it does, so two
     * commits can share a short sha prefix. `date` must be UTC.
     */
    async commitStartingWith(prefix: string, subject: string, date: string, changes: RepoChanges): Promise<string> {
      await stage(changes);
      const tree = git("write-tree");
      let parent = "";
      try {
        parent = git("rev-parse", "--verify", "--quiet", "HEAD");
      } catch {
        // The first commit has no parent.
      }
      const who = `Ana Author <ana@example.com> ${Math.floor(Date.parse(date) / 1000)} +0000`;
      for (let nonce = 0; ; nonce++) {
        const body = `tree ${tree}\n${parent ? `parent ${parent}\n` : ""}author ${who}\ncommitter ${who}\n\n${subject}\n\nNonce: ${nonce}\n`;
        const sha = createHash("sha1").update(`commit ${Buffer.byteLength(body)}\0${body}`).digest("hex");
        if (!sha.startsWith(prefix)) continue;
        execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], { cwd: repoRoot, input: body });
        git("update-ref", "HEAD", sha);
        return sha;
      }
    },
  };
}
