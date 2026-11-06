import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir, type TempDir } from "../../../tests/helpers/tmp";
import type { FsError } from "./errors";
import { imageContentType, MAX_IMAGE_BYTES, readWorkspaceImage } from "./images";
import { WorkspaceRoot } from "./workspace-root";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

let ws: TempDir;
let outside: TempDir;
let root: WorkspaceRoot;

beforeEach(async () => {
  ws = await tempDir({ "docs/notes.txt": "x", ".git/logo.png": "x", ".hidden.png": "x" });
  outside = await tempDir({ "secret.png": "secret" });
  await writeFile(path.join(ws.dir, "docs/diagram.png"), PNG);
  root = await WorkspaceRoot.open(ws.dir);
});
afterEach(async () => {
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

describe("imageContentType (SEC-12)", () => {
  it.each([
    ["a.png", "image/png"],
    ["a.jpg", "image/jpeg"],
    ["a.jpeg", "image/jpeg"],
    ["a.gif", "image/gif"],
    ["a.webp", "image/webp"],
    ["a.svg", "image/svg+xml"],
    ["dir/A.PNG", "image/png"],
  ])("maps %s to %s", (p, type) => {
    expect(imageContentType(p)).toBe(type);
  });

  it.each(["a.txt", "a.yaml", "a.html", "a.svgz", "a", "a.png.exe", "a.constructor"])(
    "refuses %s",
    (p) => {
      expect(imageContentType(p)).toBeNull();
    },
  );
});

describe("readWorkspaceImage (SEC-12, SEC-02..04)", () => {
  it("reads image bytes with the matching content type", async () => {
    const image = await readWorkspaceImage(root, "docs/diagram.png");
    expect(image.contentType).toBe("image/png");
    expect(image.bytes.equals(PNG)).toBe(true);
  });

  it("refuses other file types without reading them", async () => {
    expect(await codeOf(readWorkspaceImage(root, "docs/notes.txt"))).toBe("UNSUPPORTED_TYPE");
    // Unsupported type wins even when the file is missing: nothing is read.
    expect(await codeOf(readWorkspaceImage(root, "docs/missing.html"))).toBe("UNSUPPORTED_TYPE");
  });

  it("enforces the 5 MiB limit, inclusive", async () => {
    await writeFile(path.join(ws.dir, "exact.gif"), Buffer.alloc(MAX_IMAGE_BYTES));
    await writeFile(path.join(ws.dir, "big.gif"), Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect((await readWorkspaceImage(root, "exact.gif")).bytes.byteLength).toBe(MAX_IMAGE_BYTES);
    expect(await codeOf(readWorkspaceImage(root, "big.gif"))).toBe("TOO_LARGE");
  });

  it.each(["../secret.png", "docs/../../secret.png", "/etc/passwd.png", "C:\\x.png"])(
    "refuses traversal or absolute path %s",
    async (p) => {
      expect(await codeOf(readWorkspaceImage(root, p))).toBe("OUTSIDE_ROOT");
    },
  );

  it.each([".git/logo.png", ".hidden.png", "docs/../.git/logo.png"])(
    "refuses hidden path %s",
    async (p) => {
      expect(await codeOf(readWorkspaceImage(root, p))).toBe("INVALID_PATH");
    },
  );

  it("refuses symlinks pointing outside the root and symlinked directories", async () => {
    await symlink(path.join(outside.dir, "secret.png"), path.join(ws.dir, "link.png"));
    await symlink(outside.dir, path.join(ws.dir, "linked-dir"));
    expect(await codeOf(readWorkspaceImage(root, "link.png"))).toBe("SYMLINK_REJECTED");
    expect(await codeOf(readWorkspaceImage(root, "linked-dir/secret.png"))).toBe(
      "SYMLINK_REJECTED",
    );
  });

  it("follows a file symlink that stays inside the root", async () => {
    await symlink(path.join(ws.dir, "docs/diagram.png"), path.join(ws.dir, "alias.png"));
    expect((await readWorkspaceImage(root, "alias.png")).bytes.equals(PNG)).toBe(true);
  });

  it("reports missing files and directories as NOT_FOUND / NOT_A_FILE", async () => {
    await mkdir(path.join(ws.dir, "folder.png"));
    expect(await codeOf(readWorkspaceImage(root, "docs/missing.png"))).toBe("NOT_FOUND");
    expect(await codeOf(readWorkspaceImage(root, "folder.png"))).toBe("NOT_A_FILE");
  });

  it("refuses NUL bytes", async () => {
    expect(await codeOf(readWorkspaceImage(root, "a\0.png"))).toBe("INVALID_PATH");
  });
});
