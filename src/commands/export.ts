import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveView, type AnyView, type Issue } from "../core/index.ts";
// The render files themselves, not render/index.ts, which re-exports png.ts and so would load resvg for every caller.
import { layoutView, type Direction } from "../render/layout.ts";
import { renderSequenceSvg } from "../render/sequence-svg.ts";
import { renderSvg } from "../render/svg.ts";
import type { Theme } from "../render/tokens.ts";
import type { Checkout } from "../workspace/index.ts";

export interface ExportOptions {
  /** The View ids to draw (c1, c2/<system>, project:view-id, …), or every Saved View. */
  views: string[] | "all-saved";
  format: "svg" | "png";
  /** Wins over each View's own direction. */
  direction?: Direction;
  theme: Theme;
  /** Replaces the source line under the title. */
  label?: string;
  /** The folder the pictures go in, absolute; each is named by its View id. */
  out: string;
  /** With one View id: the picture's path, absolute, instead of one named by the id in `out`. */
  file?: string;
}

export interface ExportedFile {
  view: string;
  /** Absolute. */
  path: string;
}

export type ExportResult =
  /** The Workspace has errors; nothing was written. */
  | { kind: "errors"; issues: Issue[] }
  /** No View has this id; nothing was written. */
  | { kind: "unknown-view"; id: string }
  /** The pictures written, in order. */
  | { kind: "written"; files: ExportedFile[] };

/** Lays out and draws Views to SVG or PNG files. */
export async function exportViews(checkout: Checkout, options: ExportOptions): Promise<ExportResult> {
  const { format, direction, theme, label } = options;
  if (options.file !== undefined && (options.views === "all-saved" || options.views.length !== 1)) throw new Error("`file` names the picture of one View.");
  const { bundle, issues } = await checkout.load();
  if (issues.some((i) => i.severity === "error")) return { kind: "errors", issues };

  const views: [string, AnyView][] = [];
  if (options.views === "all-saved") {
    for (const saved of bundle.views) {
      const view = resolveView(bundle, saved.id);
      if (view) views.push([saved.id, view]);
    }
  } else {
    for (const id of options.views) {
      const view = resolveView(bundle, id);
      if (!view) return { kind: "unknown-view", id };
      views.push([id, view]);
    }
  }

  const source = { workspace: await checkout.name(), commit: bundle.commit, date: bundle.builtAt };
  const toPng = format === "png" ? (await import("../render/node.ts")).renderPngInNode : undefined;
  if (options.file === undefined) await mkdir(options.out, { recursive: true });
  const files: ExportedFile[] = [];
  for (const [id, view] of views) {
    const path = options.file ?? join(options.out, `${id.replace(/[/:]/g, "-")}.${format}`);
    // A Dynamic View draws as a sequence chart, any other as a diagram.
    const svg =
      view.kind === "dynamic"
        ? renderSequenceSvg({ bundle, view, source, theme, label })
        : renderSvg({ bundle, view, layout: await layoutView(view, direction === undefined ? {} : { direction }), source, theme, label });
    await writeFile(path, toPng ? await toPng(svg) : svg);
    files.push({ view: id, path });
  }
  return { kind: "written", files };
}
