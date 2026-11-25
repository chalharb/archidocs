/**
 * Runs the tutorial "Model your first system" end to end, as a reader would:
 * every shell block on the page in order, with every file the page shows
 * written where it says, in a temp folder (see `walkthrough.ts`). The
 * `archidocs` it runs is this repo's CLI, so the viewer must be built first
 * (`pnpm build:viewer`).
 *
 *   node website/scripts/tutorial.ts [--keep]
 *
 * It fails when a command fails, when the files the page shows don't add up
 * to the finished Workspace in `examples/tutorial/`, or when the built site
 * is missing the Model. With `--keep` it leaves the temp folder in place.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runWalkthrough, type Walkthrough } from "./walkthrough.ts";

export const TUTORIAL: Walkthrough = {
  name: "tutorial",
  page: "website/src/content/docs/docs/start/tutorial.mdx",
  example: "examples/tutorial/",
  // Installing from npm, the dev server, pushing to GitHub.
  skipped: [/^npm install --global archidocs$/, /^archidocs dev$/, /^git push\b/],
};

export function runTutorial({ keep = false } = {}): void {
  runWalkthrough(TUTORIAL, {
    keep,
    verify({ repo }) {
      // The site holds the viewer and the Model.
      const site = join(repo, "_site");
      for (const file of ["index.html", "workspace.bundle.json", "bundles/index.json"]) {
        if (!existsSync(join(site, file))) throw new Error(`The tutorial's site has no ${file}.`);
      }
      const bundle = readFileSync(join(site, "workspace.bundle.json"), "utf8");
      for (const id of ["digital:customer", "digital:spa", "digital:api", "digital:database"]) {
        if (!bundle.includes(`"${id}"`)) throw new Error(`The tutorial's Bundle has no ${id}.`);
      }
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { keep: { type: "boolean", default: false } } });
  runTutorial({ keep: values.keep });
}
