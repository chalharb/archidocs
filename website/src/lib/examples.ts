/**
 * The example Workspaces in `examples/*` and their diagrams: every Saved View
 * of a demo, and the Generated Views named by a Workspace that pages show
 * but that is not deployed. Diagrams are exported at build time with the
 * repo's own CLI, in both themes, and served from
 * `/diagrams/<example>/<theme>/<file>.svg`; they are never committed.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { repoPath, VERSION } from "./repo.ts";

/** A Workspace in `examples/` that pages show diagrams of. */
export interface DiagramSource {
  /** Its folder in `examples/`. */
  slug: string;
  name: string;
  /** Generated Views to export besides its Saved Views, such as `c2` or `c2/shop:online-shop`. */
  views?: readonly string[];
}

/** A Workspace deployed as a demo site, with a page under `/docs/examples/`. */
export interface Example extends DiagramSource {
  /** The live demo site the example deploys to. */
  demo: string;
}

export const EXAMPLES: readonly Example[] = [
  { slug: "big-bank", name: "Big Bank", demo: "https://big-bank.archidocs.dev" },
  { slug: "kitchen-sink", name: "Kitchen sink", demo: "https://kitchen-sink.archidocs.dev" },
];

/**
 * Workspaces a page shows diagrams of that are not demos: they have no site
 * (`.github/workflows/sites.yml` doesn't deploy them) and no page under
 * `/docs/examples/`.
 */
export const UNDEPLOYED: readonly DiagramSource[] = [{ slug: "quick-start", name: "Quick start", views: ["c2", "c2/shop:online-shop"] }];

/** Every Workspace whose diagrams are exported. */
export const DIAGRAM_SOURCES: readonly DiagramSource[] = [...EXAMPLES, ...UNDEPLOYED];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The header label stamped into each exported diagram, such as `Big Bank · v1.2.0`. */
export const diagramLabel = (example: DiagramSource): string => `${example.name} · v${VERSION}`;

/** The file `export --all-saved` writes for a Saved View: `digital:mainframe-outage` → `digital-mainframe-outage`. A Generated View's file is named the same way. */
export const diagramFile = (viewId: string): string => viewId.replace(/[/:]/g, "-");

export const diagramUrl = (example: DiagramSource, theme: Theme, viewId: string): string => `/diagrams/${example.slug}/${theme}/${diagramFile(viewId)}.svg`;

/** The same View in the example's live viewer. */
export const liveViewerUrl = (example: Example, viewId: string): string => `${example.demo}/#/view/${viewId}`;

export function findExample(slug: string): Example {
  const example = EXAMPLES.find((e) => e.slug === slug);
  if (!example) throw new Error(`Unknown example "${slug}". Examples: ${EXAMPLES.map((e) => e.slug).join(", ")}.`);
  return example;
}

/** The Workspace a `<Diagram>` names: a demo, or one that is shown but not deployed. */
export function findDiagramSource(slug: string): DiagramSource {
  const source = DIAGRAM_SOURCES.find((e) => e.slug === slug);
  if (!source) throw new Error(`Unknown example "${slug}". Examples: ${DIAGRAM_SOURCES.map((e) => e.slug).join(", ")}.`);
  return source;
}

/** Whether a Workspace is a demo, with a live viewer to link to. */
export const isDemo = (source: DiagramSource): source is Example => "demo" in source;

/** Every exported diagram: `<example>/<theme>/<file>` → SVG text. */
export type Diagrams = ReadonlyMap<string, string>;

const run = promisify(execFile);
let exported: Promise<Diagrams> | undefined;

/** Exports every Workspace's Saved Views, and the Generated Views it names, in both themes, once per build. */
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
      DIAGRAM_SOURCES.flatMap((example) =>
        THEMES.map(async (theme) => {
          const out = join(dir, example.slug, theme);
          const cwd = repoPath(`examples/${example.slug}/`);
          const style = ["--theme", theme, "--label", diagramLabel(example)];
          await run(process.execPath, [cli, "export", "--all-saved", "--out", out, ...style], { cwd });
          for (const view of example.views ?? []) {
            await run(process.execPath, [cli, "export", view, "--out", join(out, `${diagramFile(view)}.svg`), ...style], { cwd });
          }
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
