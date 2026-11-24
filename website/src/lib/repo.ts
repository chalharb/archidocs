/**
 * Paths into the repo this site documents. The site builds from the repo's
 * own code and files, never from the npm release, so its reference pages and
 * diagrams match the commit they were built from.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The repo root, with a trailing slash: the nearest folder at or above the
 * working directory that holds `src/cli/commands.ts`. Found from the working
 * directory, not `import.meta.url`, because the build bundles this module.
 */
export const REPO_ROOT: URL = findRoot(process.cwd());

function findRoot(from: string): URL {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "src/cli/commands.ts")) && existsSync(join(dir, "website"))) return pathToFileURL(`${dir}/`);
    if (dirname(dir) === dir) throw new Error(`Run the docs build inside the archidocs repo; no repo root above ${from}.`);
  }
}

/** The site's own folder, `website/`, with a trailing slash. */
export const WEBSITE_ROOT = new URL("website/", REPO_ROOT);

export const repoPath = (path: string): string => fileURLToPath(new URL(path, REPO_ROOT));

export const readRepoFile = (path: string): string => readFileSync(repoPath(path), "utf8");

/** The version in the root `package.json`: the release the site documents. */
export const VERSION: string = (JSON.parse(readRepoFile("package.json")) as { version: string }).version;

/** The GitHub repository, for links to source files and releases. */
export const GITHUB_URL = "https://github.com/chalharb/archidocs";
