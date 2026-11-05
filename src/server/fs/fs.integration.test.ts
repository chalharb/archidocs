import { chmod, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir, type TempDir } from "../../../tests/helpers/tmp";
import {
  atomicWriteFile,
  nodeAtomicWriteOps,
  tempPathFor,
  type AtomicWriteOps,
} from "./atomic-write";
import { discoverYamlFiles, isIgnoredName, isYamlFile } from "./discovery";
import { FsError, toFsError } from "./errors";
import { isInside, toPosix, WorkspaceRoot } from "./workspace-root";

let ws: TempDir;
let outside: TempDir;
let root: WorkspaceRoot;

beforeEach(async () => {
  ws = await tempDir({ "a.yaml": "a: 1\n", "dir/b.yml": "b: 2\n", "dir/notes.txt": "x" });
  outside = await tempDir({ "secret.yaml": "secret: 1\n", "sub/x.yaml": "x: 1\n" });
  root = await WorkspaceRoot.open(ws.dir);
});
afterEach(async () => {
  await chmod(path.join(ws.dir), 0o755).catch(() => undefined);
  await ws.cleanup();
  await outside.cleanup();
});

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return (err as FsError).code;
  }
  return "OK";
};

describe("WorkspaceRoot: SEC-02/03 restricted, traversal-safe paths", () => {
  it("reads files inside the root", async () => {
    expect(await root.readFile("dir/b.yml", 100)).toBe("b: 2\n");
    expect(await root.readFile("./dir/../a.yaml", 100)).toBe("a: 1\n");
  });

  it.each([
    "../secret.yaml",
    "dir/../../secret.yaml",
    "../../../../../../etc/passwd",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "\\\\server\\share",
  ])("rejects traversal/absolute path %s", async (p) => {
    expect(await codeOf(root.readFile(p, 100))).toBe("OUTSIDE_ROOT");
    expect(await codeOf(root.writeFileAtomic(p, "x"))).toBe("OUTSIDE_ROOT");
  });

  it("rejects the absolute path of an unauthorized target even when it exists", async () => {
    expect(await codeOf(root.readFile(path.join(outside.dir, "secret.yaml"), 100))).toBe(
      "OUTSIDE_ROOT",
    );
  });

  it("rejects NUL bytes and non-strings", async () => {
    expect(await codeOf(root.readFile("a.yaml\0.txt", 100))).toBe("INVALID_PATH");
    expect(await codeOf(root.readFile(42 as unknown as string, 100))).toBe("INVALID_PATH");
  });

  it("isInside and toPosix helpers", () => {
    expect(isInside("/r", "/r")).toBe(true);
    expect(isInside("/r", "/r/a/b")).toBe(true);
    expect(isInside("/r", "/rx")).toBe(false);
    expect(isInside("/r", "/")).toBe(false);
    expect(toPosix(["a", "b"].join(path.sep))).toBe("a/b");
  });

  it("fails to open a missing or non-directory root", async () => {
    expect(await codeOf(WorkspaceRoot.open(path.join(ws.dir, "missing")))).toBe("NOT_FOUND");
    expect(await codeOf(WorkspaceRoot.open(path.join(ws.dir, "a.yaml")))).toBe("NOT_A_FILE");
  });

  it("resolves the root through a symlinked root path", async () => {
    const link = path.join(outside.dir, "link-to-ws");
    await symlink(ws.dir, link);
    const viaLink = await WorkspaceRoot.open(link);
    expect(viaLink.realPath).toBe(root.realPath);
  });
});

describe("WorkspaceRoot: SEC-04 symlinks", () => {
  it("rejects file symlinks that escape the root", async () => {
    await symlink(path.join(outside.dir, "secret.yaml"), path.join(ws.dir, "evil.yaml"));
    expect(await codeOf(root.readFile("evil.yaml", 100))).toBe("SYMLINK_REJECTED");
  });

  it("rejects traversal through symlinked directories, inside or outside", async () => {
    await symlink(outside.dir, path.join(ws.dir, "out"));
    await symlink(path.join(ws.dir, "dir"), path.join(ws.dir, "in"));
    expect(await codeOf(root.readFile("out/secret.yaml", 100))).toBe("SYMLINK_REJECTED");
    expect(await codeOf(root.readFile("in/b.yml", 100))).toBe("SYMLINK_REJECTED");
    expect(await codeOf(root.writeFileAtomic("out/new.yaml", "x"))).toBe("SYMLINK_REJECTED");
    expect(await readdir(outside.dir)).not.toContain("new.yaml");
  });

  it("allows reading a file symlink whose target is inside the root", async () => {
    await symlink(path.join(ws.dir, "a.yaml"), path.join(ws.dir, "alias.yaml"));
    expect(await root.readFile("alias.yaml", 100)).toBe("a: 1\n");
  });

  it("never writes through a symlink, even to an inside target", async () => {
    await symlink(path.join(ws.dir, "a.yaml"), path.join(ws.dir, "alias.yaml"));
    expect(await codeOf(root.writeFileAtomic("alias.yaml", "changed"))).toBe("SYMLINK_REJECTED");
    expect(await readFile(path.join(ws.dir, "a.yaml"), "utf8")).toBe("a: 1\n");
  });

  it("reports broken symlinks", async () => {
    await symlink(path.join(ws.dir, "nope"), path.join(ws.dir, "broken.yaml"));
    expect(await codeOf(root.readFile("broken.yaml", 100))).toBe("NOT_FOUND");
  });
});

describe("WorkspaceRoot: SEC-06 size limits and file kinds", () => {
  it("rejects oversized files before reading them", async () => {
    await ws.write("big.yaml", "x".repeat(1001));
    expect(await codeOf(root.readFile("big.yaml", 1000))).toBe("TOO_LARGE");
    expect(await root.readFile("big.yaml", 1001)).toHaveLength(1001);
  });

  it("rejects directories and missing files", async () => {
    expect(await codeOf(root.readFile("dir", 100))).toBe("NOT_A_FILE");
    expect(await codeOf(root.readFile("missing.yaml", 100))).toBe("NOT_FOUND");
    expect(await root.readFileIfExists("missing.yaml", 100)).toBeNull();
    expect(await root.readFileIfExists("a.yaml", 100)).toBe("a: 1\n");
    expect(await codeOf(root.readFileIfExists("dir", 100))).toBe("NOT_A_FILE");
  });

  it("maps permission failures deterministically (FAIL-06)", async () => {
    const file = await ws.write("locked.yaml", "x: 1\n");
    await chmod(file, 0o000);
    expect(await codeOf(root.readFile("locked.yaml", 100))).toBe("PERMISSION_DENIED");
    await chmod(file, 0o644);
  });
});

describe("WorkspaceRoot: writes, dirs and removal", () => {
  it("writes atomically and preserves the file mode", async () => {
    await chmod(path.join(ws.dir, "a.yaml"), 0o600);
    await root.writeFileAtomic("a.yaml", "a: 2\n");
    expect(await readFile(path.join(ws.dir, "a.yaml"), "utf8")).toBe("a: 2\n");
    const { stat } = await import("node:fs/promises");
    expect((await stat(path.join(ws.dir, "a.yaml"))).mode & 0o777).toBe(0o600);
    expect((await readdir(ws.dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("creates new files with default permissions", async () => {
    await root.writeFileAtomic("new.yaml", "n: 1\n");
    expect(await readFile(path.join(ws.dir, "new.yaml"), "utf8")).toBe("n: 1\n");
  });

  it("fails cleanly when the parent directory is missing", async () => {
    expect(await codeOf(root.writeFileAtomic("nope/new.yaml", "x"))).toBe("NOT_FOUND");
  });

  it("creates directories and removes files idempotently", async () => {
    await root.ensureDir(".archidoc/drafts");
    await root.writeFileAtomic(".archidoc/drafts/x.json", "{}");
    await root.remove(".archidoc/drafts/x.json");
    await root.remove(".archidoc/drafts/x.json");
    expect(await readdir(path.join(ws.dir, ".archidoc/drafts"))).toEqual([]);
  });

  it("refuses to create directories through symlinks", async () => {
    await symlink(outside.dir, path.join(ws.dir, "out"));
    expect(await codeOf(root.ensureDir("out/sub"))).toBe("SYMLINK_REJECTED");
  });

  it("reports mkdir and remove failures", async () => {
    expect(await codeOf(root.ensureDir("a.yaml/sub"))).toBe("NOT_FOUND");
    // unlink(dir) is EPERM on macOS and EISDIR on Linux.
    expect(["PERMISSION_DENIED", "NOT_A_FILE"]).toContain(await codeOf(root.remove("dir")));
  });

  it("lists directories and classifies symlinks", async () => {
    await symlink(outside.dir, path.join(ws.dir, "out"));
    await mkdir(path.join(ws.dir, "fifo-dir"));
    const names = (await root.listDir("")).map((e) => `${e.name}:${e.kind}`).sort();
    expect(names).toEqual(["a.yaml:file", "dir:dir", "fifo-dir:dir", "out:symlink"]);
    expect(await root.symlinkTarget("out")).toEqual({ inside: false, kind: "dir" });
    expect(await root.symlinkTarget("missing")).toEqual({ inside: false, kind: "broken" });
    expect(await codeOf(root.listDir("a.yaml"))).toBe("NOT_FOUND");
  });
});

describe("atomicWriteFile: failure injection (RELI-08, RELI-12, FAIL-07)", () => {
  const failing = (overrides: Partial<AtomicWriteOps>): AtomicWriteOps => ({
    ...nodeAtomicWriteOps,
    ...overrides,
  });

  it("leaves the original intact and removes the temp file when the write fails", async () => {
    const target = path.join(ws.dir, "a.yaml");
    let temp = "";
    const ops = failing({
      async writeTemp(p, data, mode) {
        temp = p;
        await nodeAtomicWriteOps.writeTemp(p, data.slice(0, 2), mode); // partial write ...
        throw Object.assign(new Error("disk full"), { code: "ENOSPC" }); // ... then crash
      },
    });
    await expect(atomicWriteFile(target, "a: 999\n", ops)).rejects.toThrow("disk full");
    expect(await readFile(target, "utf8")).toBe("a: 1\n");
    expect(await readdir(ws.dir)).not.toContain(path.basename(temp));
  });

  it("leaves the original intact when the rename fails (interrupted save)", async () => {
    const target = path.join(ws.dir, "a.yaml");
    const ops = failing({
      rename: async () => Promise.reject(Object.assign(new Error("EIO"), { code: "EIO" })),
    });
    await expect(atomicWriteFile(target, "a: 999\n", ops)).rejects.toThrow("EIO");
    expect(await readFile(target, "utf8")).toBe("a: 1\n");
    expect((await readdir(ws.dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("propagates failures through WorkspaceRoot as FsErrors", async () => {
    const ops = failing({
      rename: async () => Promise.reject(Object.assign(new Error("nope"), { code: "EACCES" })),
    });
    const r = await WorkspaceRoot.open(ws.dir, ops);
    expect(await codeOf(r.writeFileAtomic("a.yaml", "x"))).toBe("PERMISSION_DENIED");
  });

  it("tolerates failing temp cleanup and directory sync", async () => {
    const target = path.join(ws.dir, "a.yaml");
    const ops = failing({
      rename: async () => Promise.reject(new Error("boom")),
      unlink: async () => Promise.reject(new Error("also boom")),
    });
    await expect(atomicWriteFile(target, "x", ops)).rejects.toThrow("boom");
    await nodeAtomicWriteOps.syncDir(path.join(ws.dir, "does-not-exist"));
  });

  it("never follows a pre-existing temp path", async () => {
    const target = path.join(ws.dir, "a.yaml");
    const temp = tempPathFor(target);
    await symlink(path.join(outside.dir, "secret.yaml"), temp);
    await expect(nodeAtomicWriteOps.writeTemp(temp, "x", 0o644)).rejects.toThrow();
    expect(await readFile(path.join(outside.dir, "secret.yaml"), "utf8")).toBe("secret: 1\n");
  });

  it("generates unique temp names in the target directory", () => {
    const a = tempPathFor("/x/y/file.yaml");
    expect(path.dirname(a)).toBe("/x/y");
    expect(a).toMatch(/\/\.file\.yaml\.\d+\.[0-9a-f]{12}\.tmp$/);
    expect(tempPathFor("/x/y/file.yaml")).not.toBe(a);
  });
});

describe("toFsError", () => {
  it.each([
    ["ENOENT", "NOT_FOUND"],
    ["ENOTDIR", "NOT_FOUND"],
    ["EACCES", "PERMISSION_DENIED"],
    ["EPERM", "PERMISSION_DENIED"],
    ["ELOOP", "SYMLINK_REJECTED"],
    ["EISDIR", "NOT_A_FILE"],
    ["EIO", "IO_ERROR"],
  ])("maps %s to %s", (code, expected) => {
    expect(toFsError(Object.assign(new Error("x"), { code }), "f").code).toBe(expected);
  });

  it("passes FsErrors through and handles non-errors", () => {
    const e = new FsError("TOO_LARGE", "big", "f");
    expect(toFsError(e, "g")).toBe(e);
    expect(toFsError("weird", "f").message).toContain("weird");
    expect(toFsError(undefined, "f").code).toBe("IO_ERROR");
  });
});

describe("discoverYamlFiles (P0-04)", () => {
  it("finds YAML files recursively in sorted order, skipping hidden and node_modules", async () => {
    await ws.write("z/c.YAML", "");
    await ws.write(".git/config.yaml", "");
    await ws.write(".archidoc/drafts/d.yaml", "");
    await ws.write("node_modules/pkg/x.yaml", "");
    await ws.write("dir/.hidden.yaml", "");
    const { files, diagnostics } = await discoverYamlFiles(root);
    expect(files).toEqual(["a.yaml", "dir/b.yml", "z/c.YAML"]);
    expect(diagnostics).toEqual([]);
  });

  it("reports escaping and directory symlinks, includes inside file symlinks", async () => {
    await symlink(path.join(outside.dir, "secret.yaml"), path.join(ws.dir, "evil.yaml"));
    await symlink(outside.dir, path.join(ws.dir, "outdir"));
    await symlink(path.join(ws.dir, "dir"), path.join(ws.dir, "indir"));
    await symlink(path.join(ws.dir, "a.yaml"), path.join(ws.dir, "alias.yaml"));
    await symlink(path.join(ws.dir, "dir/notes.txt"), path.join(ws.dir, "notes-link.txt"));
    const { files, diagnostics } = await discoverYamlFiles(root);
    expect(files).toEqual(["a.yaml", "alias.yaml", "dir/b.yml"]);
    expect(diagnostics.map((d) => [d.code, d.severity, d.file])).toEqual([
      ["FS_SYMLINK_REJECTED", "error", "evil.yaml"],
      ["FS_SYMLINK_REJECTED", "warning", "indir"],
      ["FS_SYMLINK_REJECTED", "error", "outdir"],
    ]);
  });

  it("enforces the file count limit deterministically", async () => {
    for (const n of [1, 2, 3, 4]) await ws.write(`many/f${n}.yaml`, "");
    const { files, diagnostics } = await discoverYamlFiles(root, {
      maxFiles: 3,
      maxDirectoryDepth: 10,
    });
    expect(files).toEqual(["a.yaml", "dir/b.yml", "many/f1.yaml"]);
    expect(diagnostics.map((d) => d.code)).toEqual(["FS_TOO_MANY_FILES"]);
  });

  it("enforces the directory depth limit", async () => {
    await ws.write("1/2/3/deep.yaml", "");
    const { files, diagnostics } = await discoverYamlFiles(root, {
      maxFiles: 100,
      maxDirectoryDepth: 2,
    });
    expect(files).not.toContain("1/2/3/deep.yaml");
    expect(diagnostics.map((d) => d.code)).toEqual(["FS_TOO_MANY_FILES"]);
  });

  it("reports unreadable directories without failing", async () => {
    const locked = path.join(ws.dir, "locked");
    await mkdir(locked);
    await writeFile(path.join(locked, "x.yaml"), "");
    await chmod(locked, 0o000);
    const { files, diagnostics } = await discoverYamlFiles(root);
    await chmod(locked, 0o755);
    expect(files).toEqual(["a.yaml", "dir/b.yml"]);
    expect(diagnostics.map((d) => [d.code, d.file])).toEqual([["FS_READ_ERROR", "locked"]]);
  });

  it("reports an unreadable root", async () => {
    await chmod(ws.dir, 0o000);
    const { files, diagnostics } = await discoverYamlFiles(root);
    await chmod(ws.dir, 0o755);
    expect(files).toEqual([]);
    expect(diagnostics[0]).toMatchObject({ code: "FS_READ_ERROR" });
    expect(diagnostics[0]!.file).toBeUndefined();
  });

  it("name helpers", () => {
    expect(isIgnoredName(".git")).toBe(true);
    expect(isIgnoredName("node_modules")).toBe(true);
    expect(isIgnoredName("src")).toBe(false);
    expect(isYamlFile("a.yml")).toBe(true);
    expect(isYamlFile("a.yaml.bak")).toBe(false);
  });
});
