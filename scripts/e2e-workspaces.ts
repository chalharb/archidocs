/**
 * Prepare workspaces for the Playwright suite (run before the server starts):
 *  - scratch: a writable copy of the sample workspace, edited by the E2E workflows
 *  - large:   the deterministic medium benchmark workspace (VR-08, BENCH-04)
 * Read-only workspaces (the sample itself, tests/fixtures/visual) are used in place.
 */
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { writeBenchWorkspace } from "../tests/bench/fixture.ts";

export const E2E_DIR = path.resolve(import.meta.dirname, "../.e2e-workspaces");

await rm(E2E_DIR, { recursive: true, force: true });
await cp(path.resolve(import.meta.dirname, "../examples/sample-workspace"), path.join(E2E_DIR, "scratch"), {
  recursive: true,
});
await writeBenchWorkspace(path.join(E2E_DIR, "large"));
console.log(`Prepared E2E workspaces in ${E2E_DIR}`);
