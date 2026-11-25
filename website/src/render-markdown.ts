/**
 * The Markdown copy of each page (`<page>.md`, and "Copy as Markdown"), for
 * starlight-llm-actions: the page's source with its sample fences filled from
 * their files, its Diagrams as images (with a link to the live viewer when
 * the example has one), each tab under its label, and the MDX imports and
 * layout-only component tags taken out.
 */
import type { MarkdownRenderer } from "starlight-llm-actions";
import { diagramFile, findDiagramSource, isDemo, liveViewerUrl } from "./lib/examples.ts";
import { fillSamples } from "./lib/samples.ts";

const attribute = (tag: string, name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** `<Diagram view="big-bank/digital:mainframe-outage" alt="…" />` as a Markdown image and, for a demo, a link. */
function diagramMarkdown(tag: string): string {
  const view = attribute(tag, "view");
  const alt = attribute(tag, "alt") ?? "";
  if (!view?.includes("/")) return tag;
  const example = findDiagramSource(view.slice(0, view.indexOf("/")));
  const viewId = view.slice(view.indexOf("/") + 1);
  const image = `![${alt}](/diagrams/${example.slug}/light/${diagramFile(viewId)}.svg)`;
  return isDemo(example) ? `${image}\n\n[Open in the live viewer](${liveViewerUrl(example, viewId)})` : image;
}

/** The page body as Markdown, from its Markdown or MDX source. */
export function pageMarkdown(body: string): string {
  return (
    fillSamples(body)
      .replace(/^import\s.*?from\s+["'][^"']+["'];?\n/gm, "")
      .replace(/<Diagram\b[^>]*\/>/g, diagramMarkdown)
      // A tab reads as its label in bold, then what it holds: `<TabItem label="pnpm">` → `**pnpm**`.
      .replace(/^[ \t]*<TabItem\b[^>]*>[ \t]*$/gm, (tag) => `**${attribute(tag, "label") ?? ""}**`)
      .replace(/^[ \t]*<\/TabItem>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<Tabs\b[^>]*>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<\/Tabs>[ \t]*\n\n?/gm, "")
      .replace(/^[ \t]*<\/?(?:Flow|Steps)>[ \t]*\n/gm, "")
      .replace(/^\n+/, "")
  );
}

const render: MarkdownRenderer = (entry) => pageMarkdown(entry.body ?? "");

export default render;
