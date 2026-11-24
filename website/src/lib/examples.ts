/**
 * The example Workspaces in `examples/*` and their Saved View diagrams.
 * Diagrams are exported at build time with the repo's own CLI, in both
 * themes, and served from `/diagrams/<example>/<theme>/<file>.svg`; they are
 * never committed.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { repoPath, VERSION } from "./repo.ts";

export interface Example {
  /** Its folder in `examples/`, and its page under `/docs/examples/`. */
  slug: string;
  name: string;
  /** The live demo site the example deploys to. */
  demo: string;
}

export const EXAMPLES: readonly Example[] = [
  { slug: "big-bank", name: "Big Bank", demo: "https://big-bank.archidocs.dev" },
  { slug: "kitchen-sink", name: "Kitchen sink", demo: "https://kitchen-sink.archidocs.dev" },
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The header label stamped into each exported diagram, such as `Big Bank · v1.2.0`. */
export const diagramLabel = (example: Example): string => `${example.name} · v${VERSION}`;

/** The file `export --all-saved` writes for a Saved View: `digital:mainframe-outage` → `digital-mainframe-outage`. */
export const diagramFile = (viewId: string): string => viewId.replace(/[/:]/g, "-");

export const diagramUrl = (example: Example, theme: Theme, viewId: string): string => `/diagrams/${example.slug}/${theme}/${diagramFile(viewId)}.svg`;

/** The same View in the example's live viewer. */
export const liveViewerUrl = (example: Example, viewId: string): string => `${example.demo}/#/view/${viewId}`;

export function findExample(slug: string): Example {
  const example = EXAMPLES.find((e) => e.slug === slug);
  if (!example) throw new Error(`Unknown example "${slug}". Examples: ${EXAMPLES.map((e) => e.slug).join(", ")}.`);
  return example;
}

/** Every exported diagram: `<example>/<theme>/<file>` → SVG text. */
export type Diagrams = ReadonlyMap<string, string>;

const run = promisify(execFile);
let exported: Promise<Diagrams> | undefined;

/** Exports every example's Saved Views in both themes, once per build. */
export function exportDiagrams(): Promise<Diagrams> {
  exported ??= exportAll();
  return exported;
}

async function exportAll(): Promise<Diagrams> {
  const cli = repoPath("src/cli/main.ts");
  const dir = await mkdtemp(join(tmpdir(), "archidocs-diagrams-"));
  const diagrams = new Map<string, string>();
  try {
    await Promise.all(
      EXAMPLES.flatMap((example) =>
        THEMES.map(async (theme) => {
          const out = join(dir, example.slug, theme);
          await run(process.execPath, [cli, "export", "--all-saved", "--out", out, "--theme", theme, "--label", diagramLabel(example)], { cwd: repoPath(`examples/${example.slug}/`) });
          for (const file of (await readdir(out)).filter((f) => f.endsWith(".svg")).sort()) {
            diagrams.set(`${example.slug}/${theme}/${file.slice(0, -".svg".length)}`, await readFile(join(out, file), "utf8"));
          }
        }),
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return diagrams;
}
