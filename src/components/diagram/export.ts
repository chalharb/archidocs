"use client";

/**
 * PNG and SVG export (LAYOUT-15). Renders the whole diagram (not just the
 * visible part) at scale 1, with a margin, and always statically: the editor
 * stops rendering edge flow animation while exporting (LAYOUT-25).
 */
import { getNodesBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export type ExportFormat = "png" | "svg";

export const EXPORT_MARGIN = 40;
export const PNG_PIXEL_RATIO = 2;

/** SVG paint properties that come from stylesheets and must be inlined for export. */
export const SVG_PAINT_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-opacity",
  "opacity",
  "display",
] as const;

/**
 * html-to-image copies `<svg>` subtrees verbatim, without the stylesheet, so
 * class-based fills, strokes and dashes would be lost. Inline the computed
 * values for the duration of the export; the returned function restores them.
 */
export function inlineSvgStyles(root: Element): () => void {
  const restore: Array<() => void> = [];
  for (const el of root.querySelectorAll<SVGElement>("svg *")) {
    const previous = el.getAttribute("style");
    const computed = getComputedStyle(el);
    for (const prop of SVG_PAINT_PROPERTIES)
      el.style.setProperty(prop, computed.getPropertyValue(prop));
    restore.push(() =>
      previous === null ? el.removeAttribute("style") : el.setAttribute("style", previous),
    );
  }
  return () => restore.forEach((r) => r());
}

export async function renderDiagramImage(
  container: HTMLElement,
  nodes: Node[],
  format: ExportFormat,
): Promise<string> {
  const viewport = container.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) throw new Error("Diagram is not rendered");
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + EXPORT_MARGIN * 2);
  const height = Math.ceil(bounds.height + EXPORT_MARGIN * 2);
  const background =
    getComputedStyle(container).getPropertyValue("--arch-canvas").trim() || "#ffffff";
  const options = {
    backgroundColor: background,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${EXPORT_MARGIN - bounds.x}px, ${EXPORT_MARGIN - bounds.y}px) scale(1)`,
    },
  };
  container.classList.add("arch-static");
  const restoreStyles = inlineSvgStyles(viewport);
  try {
    return format === "png"
      ? await toPng(viewport, { ...options, pixelRatio: PNG_PIXEL_RATIO })
      : await toSvg(viewport, options);
  } finally {
    restoreStyles();
    container.classList.remove("arch-static");
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
