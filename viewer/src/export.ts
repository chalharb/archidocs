import type { ResolvedDynamicView, ResolvedView } from "../../src/core/views/index.ts";
import type { Direction } from "../../src/render/layout.ts";
import { layoutInWorker } from "./layout.ts";
import type { Workspace } from "./workspace.ts";

export type ExportFormat = "svg" | "png";

/**
 * Draws a View as `archidocs export` does: laid out afresh with the shared
 * `layoutView`, then drawn by the shared `renderSvg` (and rasterised by the
 * shared `renderPng`), with the Workspace, commit and date in its source line.
 */
export async function picture(workspace: Workspace, view: ResolvedView, direction: Direction | undefined, format: ExportFormat): Promise<Blob> {
  const [reply, { renderSvg }] = await Promise.all([layoutInWorker(view, direction), import("../../src/render/svg.ts")]);
  if ("error" in reply) throw new Error(reply.error);
  const { bundle } = workspace;
  const svg = renderSvg({ bundle, view, layout: reply.layout, source: { workspace: workspace.workspaceName, commit: bundle.commit, date: bundle.builtAt } });
  return blobOf(svg, format);
}

/**
 * Draws a Dynamic View as `archidocs export` does: the sequence chart from the
 * shared `renderSequenceSvg`, whichever of Sequence or Graph is on screen. With
 * `brokers` (the viewer's Show brokers), event Steps go through their brokers.
 */
export async function sequencePicture(workspace: Workspace, view: ResolvedDynamicView, brokers: boolean, format: ExportFormat): Promise<Blob> {
  const { renderSequenceSvg } = await import("../../src/render/sequence-svg.ts");
  const { bundle } = workspace;
  const svg = renderSequenceSvg({ bundle, view, brokers, source: { workspace: workspace.workspaceName, commit: bundle.commit, date: bundle.builtAt } });
  return blobOf(svg, format);
}

/** An SVG document as a file of the format asked for, rasterised by the shared `renderPng` for PNG. */
async function blobOf(svg: string, format: ExportFormat): Promise<Blob> {
  if (format === "svg") return new Blob([svg], { type: "image/svg+xml" });
  const [{ renderPng }, { default: wasm }] = await Promise.all([import("../../src/render/png.ts"), import("@resvg/resvg-wasm/index_bg.wasm?url")]);
  const png = await renderPng(svg, fetch(wasm));
  return new Blob([png as Uint8Array<ArrayBuffer>], { type: "image/png" });
}

/** The file a picture saves as: the View's id with `/` and `:` turned into `-`, as `archidocs export` names it. */
export const fileName = (view: string, format: ExportFormat, picks = false) => `${view.replace(/[/:]/g, "-")}${picks ? "-picks" : ""}.${format}`;

/** Hands the browser a file to save. */
export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
