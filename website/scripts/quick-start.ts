/**
 * Runs the quick start end to end, as a reader would: every shell block on
 * the page in order, with every file the page shows written where it says,
 * in an empty repo in a temp folder (see `walkthrough.ts`). The `archidocs`
 * it runs is this repo's CLI, so the viewer must be built first
 * (`pnpm build:viewer`).
 *
 *   node website/scripts/quick-start.ts [--keep]
 *
 * It fails when a command fails, when the files the page shows don't add up
 * to the finished Workspace in `examples/quick-start/`, when `archidocs
 * check` finds anything or prints something other than the page shows, when
 * the Model is not two Services in one System, or when the README's Quick
 * start section has drifted from the page. With `--keep` it leaves the temp
 * folder in place.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { repoPath } from "../src/lib/repo.ts";
import { fences, finishedRepo, runWalkthrough, shellLines, type Fence, type Walkthrough } from "./walkthrough.ts";

export const QUICK_START: Walkthrough = {
  name: "quick start",
  page: "website/src/content/docs/docs/start/quick-start.mdx",
  example: "examples/quick-start/",
  // Installing from npm, either way, and the dev server.
  skipped: [/^npm install --global archidocs$/, /^pnpm add --global archidocs$/, /^archidocs dev$/],
  // The page starts in the repo that will hold the Workspace: here, a new and empty one.
  before: ["git init --quiet shop", "cd shop"],
};

/** The `archidocs …` lines a document tells the reader to run, in order. */
const archidocsLines = (blocks: Fence[]): string[] => blocks.flatMap(shellLines).filter((line) => line.startsWith("archidocs "));

/** What a document says `archidocs check` prints: the `text` block right after the block that runs it. */
function shownCheckOutput(blocks: Fence[], where: string): string {
  const at = blocks.findIndex((fence) => shellLines(fence).join("\n") === "archidocs check");
  const output = blocks[at + 1];
  if (at < 0 || output?.lang !== "text") throw new Error(`${where} doesn't show what \`archidocs check\` prints, in a text block right after it.`);
  return output.body.trim();
}

interface Bundle {
  teams: unknown[];
  environments: unknown[];
  elements: { id: string; kind: string; parent: string | null }[];
  relationships: unknown[];
}

export function runQuickStart({ keep = false } = {}): void {
  const page = fences(readFileSync(repoPath(QUICK_START.page), "utf8"));
  const section = /^## Quick start\n([\s\S]*?)(?=^## )/m.exec(readFileSync(repoPath("README.md"), "utf8"))?.[1];
  if (section === undefined) throw new Error("README.md has no Quick start section.");
  const readme = fences(section);

  runWalkthrough(QUICK_START, {
    keep,
    verify({ tmp, files, archidocs }) {
      // `check` passes, and prints what the page and the README say it prints.
      const { issues } = JSON.parse(archidocs("check", "--format", "json")) as { issues: unknown[] };
      if (issues.length > 0) throw new Error(`\`archidocs check\` finds ${issues.length} issues in the quick start's Workspace.`);
      const printed = archidocs("check").trim();
      for (const [where, blocks] of [["The quick start", page], ["The README's Quick start", readme]] as const) {
        const shown = shownCheckOutput(blocks, where);
        if (shown !== printed) throw new Error(`${where} shows \`archidocs check\` printing "${shown}", but it prints "${printed}".`);
      }

      // The Model is what the page promises the viewer shows: a Person, and two Services in one System.
      const out = join(tmp, "bundle");
      archidocs("build", "--bundle-only", "--out", out);
      const bundle = JSON.parse(readFileSync(join(out, "workspace.bundle.json"), "utf8")) as Bundle;
      const ofKind = (kind: string) => bundle.elements.filter((e) => e.kind === kind);
      const [systems, services] = [ofKind("system"), ofKind("service")];
      const summary = (counts: Record<string, number>) => Object.entries(counts).map(([what, n]) => `${what}: ${n}`).join(", ");
      const has = summary({ Teams: bundle.teams.length, Environments: bundle.environments.length, People: ofKind("person").length, Systems: systems.length, Services: services.length, Relationships: bundle.relationships.length });
      const promised = summary({ Teams: 1, Environments: 1, People: 1, Systems: 1, Services: 2, Relationships: 2 });
      if (has !== promised) throw new Error(`The quick start's Model should have ${promised}; it has ${has}.`);
      const outside = services.filter((s) => s.parent !== systems[0]!.id).map((s) => s.id);
      if (outside.length > 0) throw new Error(`The quick start's Services should both be in ${systems[0]!.id}; ${outside.join(", ")} isn't.`);

      // The README's Quick start follows the same steps: the same commands, and the same files in full.
      const [onPage, inReadme] = [archidocsLines(page), archidocsLines(readme)];
      if (inReadme.join("\n") !== onPage.join("\n")) throw new Error(`The README's Quick start runs ${inReadme.join(", ")}; the quick start page runs ${onPage.join(", ")}.`);
      const finished = finishedRepo(QUICK_START.example);
      const typed = readme.filter((fence) => fence.lang === "yaml").map((fence) => fence.body.trimEnd());
      if (typed.length !== files.length) throw new Error(`The README's Quick start shows ${typed.length} files; the quick start page shows ${files.length}.`);
      files.forEach((path, i) => {
        if (typed[i] !== finished.get(path)!.trimEnd()) throw new Error(`File ${i + 1} in the README's Quick start differs from ${QUICK_START.example}${path}.`);
      });
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { keep: { type: "boolean", default: false } } });
  runQuickStart({ keep: values.keep });
}
