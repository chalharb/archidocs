import { readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES, type DiagnosticCode } from "@/domain/diagnostics";
import { WorkspaceRoot } from "@/server/fs/workspace-root";
import { loadWorkspace } from "@/server/workspace/loader";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/invalid");

/** Codes that need filesystem setup or runtime state, with the tests that cover them. */
const COVERED_ELSEWHERE: Partial<Record<DiagnosticCode, string>> = {
  FS_OUTSIDE_ROOT: "src/server/fs/fs.integration.test.ts (traversal is an FsError, never loaded)",
  FS_SYMLINK_REJECTED: "src/server/fs/fs.integration.test.ts › discoverYamlFiles",
  FS_TOO_LARGE: "src/server/workspace/repository.integration.test.ts › never crashes",
  FS_TOO_MANY_FILES: "src/server/fs/fs.integration.test.ts › file count limit",
  FS_READ_ERROR: "src/server/fs/fs.integration.test.ts › unreadable directories",
  LAYOUT_COLLISION: "src/domain/layout/layout.test.ts › unresolved collisions",
  MODEL_STALE: "src/server/http/handlers.integration.test.ts › stale state",
};

describe("P0-10 invalid-input fixtures", async () => {
  const dirs = (await readdir(FIXTURES, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it("every diagnostic code has a fixture or a documented test", () => {
    const missing = DIAGNOSTIC_CODES.filter((c) => !dirs.includes(c) && !(c in COVERED_ELSEWHERE));
    expect(missing).toEqual([]);
    expect(dirs.filter((d) => !(DIAGNOSTIC_CODES as readonly string[]).includes(d))).toEqual([]);
  });

  it.each(dirs)("%s fixture produces exactly that diagnostic", async (code) => {
    const root = await WorkspaceRoot.open(path.join(FIXTURES, code));
    const { diagnostics } = await loadWorkspace(root);
    const codes = [...new Set(diagnostics.map((d) => d.code))];
    expect(codes).toEqual([code]);
    for (const d of diagnostics) expect(d.message.length).toBeGreaterThan(0);
  });
});
