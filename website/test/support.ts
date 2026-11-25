import { execFile } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { repoPath } from "../src/lib/repo.ts";

const run = promisify(execFile);
const WEBSITE = repoPath("website");

export interface BuildResult {
  ok: boolean;
  outDir: string;
  output: string;
}

/**
 * Builds the site into a temp folder. With `pages`, it builds a copy of
 * `src/` whose docs also hold those pages (path under `src/content/docs/docs/`
 * → content); everything else in the copy links back to the real `src/`.
 */
export async function buildSite({ pages }: { pages?: Record<string, string> } = {}): Promise<BuildResult> {
  const tmp = mkdtempSync(join(tmpdir(), "archidocs-site-"));
  const outDir = join(tmp, "dist");
  // Its own output and cache folders, so test builds never touch website/dist or each other.
  const env: NodeJS.ProcessEnv = { ...process.env, ARCHIDOCS_DOCS_OUT_DIR: outDir, ARCHIDOCS_DOCS_CACHE_DIR: join(tmp, "cache") };
  if (pages) {
    const src = join(tmp, "src");
    mkdirSync(src);
    for (const entry of readdirSync(join(WEBSITE, "src"))) {
      if (entry !== "content") symlinkSync(join(WEBSITE, "src", entry), join(src, entry));
    }
    cpSync(join(WEBSITE, "src/content"), join(src, "content"), { recursive: true });
    // The copied pages sit outside the repo, so a package they import (`@astrojs/starlight/components`) is found here.
    symlinkSync(join(WEBSITE, "node_modules"), join(tmp, "node_modules"));
    for (const [path, text] of Object.entries(pages)) {
      const file = join(src, "content/docs/docs", path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, text);
    }
    env["ARCHIDOCS_DOCS_SRC_DIR"] = src;
  }
  try {
    const { stdout, stderr } = await run("pnpm", ["exec", "astro", "build"], { cwd: WEBSITE, env, maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, outDir, output: stdout + stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, outDir, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
