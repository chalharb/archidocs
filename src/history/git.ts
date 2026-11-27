import { join, relative, sep } from "node:path";
import type { DirEntry, FileSystem } from "../core/fs.ts";
import { git } from "../git.ts";

/**
 * A read-only FileSystem over the tree of one commit. Paths are absolute
 * under `repoRoot`, as on disk; files are read with `git show`, so no
 * worktree is needed.
 */
export async function gitFileSystem(repoRoot: string, commit: string): Promise<FileSystem> {
  // Every blob and tree in the commit, by its folder.
  const children = new Map<string, DirEntry[]>([["", []]]);
  const kinds = new Map<string, "blob" | "tree">([["", "tree"]]);
  for (const line of (await git(repoRoot, "ls-tree", "-r", "-t", "-z", "--full-tree", commit)).split("\0")) {
    const match = /^\d+ (blob|tree) \S+\t(.*)$/s.exec(line);
    if (!match) continue; // submodules and the trailing empty entry
    const [, kind, path] = match as unknown as [string, "blob" | "tree", string];
    kinds.set(path, kind);
    if (kind === "tree") children.set(path, children.get(path) ?? []);
    const slash = path.lastIndexOf("/");
    const dir = slash < 0 ? "" : path.slice(0, slash);
    children.set(dir, [...(children.get(dir) ?? []), { name: path.slice(slash + 1), isDirectory: kind === "tree" }]);
  }
  const inRepo = (path: string) => {
    const rel = relative(repoRoot, path).split(sep).join("/");
    return rel.startsWith("..") ? undefined : rel;
  };
  const missing = (path: string) => Object.assign(new Error(`ENOENT: no such file or directory at ${commit.slice(0, 7)}, '${path}'`), { code: "ENOENT" });
  return {
    readFile: async (path) => {
      const rel = inRepo(path);
      if (rel === undefined || kinds.get(rel) !== "blob") throw missing(path);
      return git(repoRoot, "show", `${commit}:${rel}`);
    },
    readDir: async (path) => {
      const rel = inRepo(path);
      const entries = rel === undefined ? undefined : children.get(rel);
      if (!entries) throw missing(path);
      return entries;
    },
    exists: async (path) => {
      const rel = inRepo(path);
      return rel !== undefined && kinds.has(rel);
    },
  };
}

/** A commit's sha, committer date (ISO 8601), author name and subject. */
export interface CommitInfo {
  sha: string;
  date: string;
  author: string;
  subject: string;
}

const COMMIT_FORMAT = "%H%x00%cI%x00%an%x00%s";
const parseCommit = (line: string): CommitInfo => {
  const [sha, date, author, subject] = line.split("\0") as [string, string, string, string];
  return { sha, date, author, subject };
};

export async function commitInfo(repoRoot: string, sha: string): Promise<CommitInfo> {
  return parseCommit((await git(repoRoot, "log", "-1", `--format=${COMMIT_FORMAT}`, sha)).trim());
}

/**
 * The default branch: what `origin/HEAD` points at, else a local `main` or
 * `master`, else HEAD.
 */
export async function defaultBranch(repoRoot: string): Promise<string> {
  for (const candidate of ["refs/remotes/origin/HEAD", "refs/heads/main", "refs/heads/master"]) {
    if (await git(repoRoot, "rev-parse", "--verify", "--quiet", `${candidate}^{commit}`).then(() => true, () => false)) return candidate;
  }
  return "HEAD";
}

/**
 * First-parent commits on `branch`, newest first, that changed something
 * under `path` (relative to the repo root; "" is the whole repo) against
 * their first parent. A merge counts by what it brought to the branch.
 */
export async function firstParentCommitsTouching(repoRoot: string, branch: string, path: string): Promise<CommitInfo[]> {
  // `:(literal)` keeps spaces and glob characters in `path` literal; `--` keeps a path that is gone from the tip a path.
  // The whole repo is still a pathspec ("."), so commits that change nothing drop out as they do for any folder.
  const out = await git(repoRoot, "log", "--first-parent", `--format=${COMMIT_FORMAT}`, branch, "--", path === "" ? "." : `:(literal)${path}`);
  return out.split("\n").filter(Boolean).map(parseCommit);
}

/** Tag names by the commit they point at. */
export async function tagsByCommit(repoRoot: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const out = await git(repoRoot, "for-each-ref", "--format=%(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end) %(refname:short)", "refs/tags");
  for (const line of out.split("\n").filter(Boolean)) {
    const [sha, name] = line.split(" ") as [string, string];
    map.set(sha, [...(map.get(sha) ?? []), name].sort());
  }
  return map;
}

export const joinRepo = (repoRoot: string, rel: string) => (rel === "" ? repoRoot : join(repoRoot, rel));
