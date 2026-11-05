"use client";

/**
 * PNG and SVG export (LAYOUT-15). Renders the whole diagram (not just the
 * visible part) at scale 1, with a margin, and always statically: animated
 * edges are hidden while exporting (LAYOUT-25).
 */
import { getNodesBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export type ExportFormat = "png" | "svg";

export const EXPORT_MARGIN = 40;
export const PNG_PIXEL_RATIO = 2;

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
  try {
    return format === "png"
      ? await toPng(viewport, { ...options, pixelRatio: PNG_PIXEL_RATIO })
      : await toSvg(viewport, options);
  } finally {
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
