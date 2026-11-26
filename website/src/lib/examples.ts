/**
 * The example Workspaces in `examples/*` and their diagrams: every Saved View
 * of a demo, and the Generated Views named by a Workspace that pages show
 * but that is not deployed. Diagrams are exported at build time with the
 * repo's own `export` command, in both themes, and served from
 * `/diagrams/<example>/<theme>/<file>.svg`; they are never committed.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportViews, type ExportedFile, type ExportOptions } from "../../../src/commands/index.ts";
import { findCheckout } from "../../../src/workspace/index.ts";
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

let exported: Promise<Diagrams> | undefined;

/** Exports every Workspace's Saved Views, and the Generated Views it names, in both themes, once per build. */
export function exportDiagrams(): Promise<Diagrams> {
  exported ??= exportAll();
  return exported;
}

/**
 * Runs every example × theme at once, in this process. That is safe: the
 * shared ELK instance matches each layout's reply by its own id and lays out
 * one graph at a time in-thread, and exporting SVG reads no cache (no history,
 * no PNG renderer).
 */
async function exportAll(): Promise<Diagrams> {
  const dir = await mkdtemp(join(tmpdir(), "archidocs-diagrams-"));
  const diagrams = new Map<string, string>();
  try {
    await Promise.all(
      DIAGRAM_SOURCES.flatMap((example) =>
        THEMES.map(async (theme) => {
          const out = join(dir, example.slug, theme);
          // Found from the example's folder as the CLI finds it: the folder or its archidocs/.
          const checkout = await findCheckout(repoPath(`examples/${example.slug}/`));
          if (!checkout) throw new Error(`examples/${example.slug}/ holds no Workspace.`);
          const style = { format: "svg", theme, label: diagramLabel(example), out } as const;
          const runs: Pick<ExportOptions, "views" | "file">[] = [
            { views: "all-saved" },
            ...(example.views ?? []).map((view) => ({ views: [view], file: join(out, `${diagramFile(view)}.svg`) })),
          ];
          const files: ExportedFile[] = [];
          for (const options of runs) {
            const result = await exportViews(checkout, { ...style, ...options });
            if (result.kind !== "written") throw new Error(`Exporting ${example.slug} (${theme}) failed: ${JSON.stringify(result)}`);
            files.push(...result.files);
          }
          for (const name of files.map(({ view }) => diagramFile(view)).sort()) {
            diagrams.set(`${example.slug}/${theme}/${name}`, await readFile(join(out, `${name}.svg`), "utf8"));
          }
        }),
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return diagrams;
}
