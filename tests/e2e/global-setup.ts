import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const cli = path.resolve("dist/cli/index.js");

/** Builds the starter workspace twice: once for the root and once for a sub-path. */
function buildSite(outDir: string, base: string): void {
  const workspace = mkdtempSync(path.join(tmpdir(), "archidocs-e2e-"));
  // Let the starter config resolve the package the way an installed copy would.
  mkdirSync(path.join(workspace, "node_modules"));
  symlinkSync(path.resolve("."), path.join(workspace, "node_modules", "archidocs"), "dir");
  const run = (...args: string[]) => execFileSync("node", [cli, ...args], { cwd: workspace });
  run("init");
  const configFile = path.join(workspace, "archidocs.config.ts");
  writeFileSync(
    configFile,
    readFileSync(configFile, "utf8").replace('base: "/"', `base: ${JSON.stringify(base)}`),
  );
  run("build", "--out", outDir);
  rmSync(workspace, { recursive: true, force: true });
}

export default function globalSetup(): void {
  buildSite(path.resolve(".e2e/root"), "/");
  buildSite(path.resolve(".e2e/sub"), "/.notes/archi/");
}
