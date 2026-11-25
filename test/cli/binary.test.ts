// The built binary's own smoke tests: these spawn `src/cli/main.ts`, so they cover
// the wiring from `process` into `run`. Every other CLI test calls `run` in-process
// through `archidocs()`; `mcp.test.ts` also spawns, for MCP over stdio.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT, NO_WORKSPACE } from "../../src/cli/commands.ts";
import { archidocsBinary } from "../support/cli.ts";

describe("the archidocs binary", () => {
  it("prints its version and exits 0", async () => {
    const { code, stdout } = await archidocsBinary(tmpdir(), "version");
    expect(code).toBe(EXIT.ok);
    expect(stdout).toMatch(/^archidocs \S+ \(Bundle schemaVersion \d+\)\n$/);
  });

  it("exits 2 with the usage text on an unknown command", async () => {
    const { code, stderr } = await archidocsBinary(tmpdir(), "frobnicate");
    expect(code).toBe(EXIT.couldNotRun);
    expect(stderr).toContain('archidocs: Unknown command "frobnicate".\n');
    expect(stderr).toContain("Usage:");
  });

  it("exits 2 when no Workspace is found", async () => {
    const empty = await mkdtemp(join(tmpdir(), "archidocs-empty-"));
    const { code, stderr } = await archidocsBinary(empty, "check");
    expect(code).toBe(EXIT.couldNotRun);
    expect(stderr).toContain(`archidocs: ${NO_WORKSPACE}\n`);
  });
});
