/**
 * The Markdown copy of each page (`<page>.md`, and "Copy as Markdown"), for
 * starlight-llm-actions: the page's source with its sample fences filled from
 * their files, its Diagrams as images (with a link to the live viewer when
 * the example has one), each tab under its label, its link cards and page
 * lists as Markdown lists, and the MDX imports and layout-only component tags
 * taken out.
 */
import type { MarkdownRenderer } from "starlight-llm-actions";
import { diagramFile, findDiagramSource, isDemo, liveViewerUrl } from "./lib/examples.ts";
import { listPages, pageListMarkdown, type ListableEntry } from "./lib/page-list.ts";
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

/** `<LinkCard title="…" href="…" description="…" />` as a list item, so a card grid reads as a list of links. */
function linkCardMarkdown(tag: string): string {
  const description = attribute(tag, "description");
  return `- [${attribute(tag, "title") ?? ""}](${attribute(tag, "href") ?? ""})${description ? `: ${description}` : ""}`;
}

/**
 * The page body as Markdown, from its Markdown or MDX source. With `entries`
 * (the docs collection), each `<PageList directory="…" />` becomes the list
 * the page shows.
 */
export function pageMarkdown(body: string, entries: readonly ListableEntry[] = []): string {
  return (
    fillSamples(body)
      .replace(/^import\s.*?from\s+["'][^"']+["'];?\n/gm, "")
      .replace(/<Diagram\b[^>]*\/>/g, diagramMarkdown)
      .replace(/^[ \t]*<LinkCard\b[^>]*\/>/gm, linkCardMarkdown)
      .replace(/<PageList\b[^>]*\/>/g, (tag) => pageListMarkdown(listPages(entries, attribute(tag, "directory") ?? "")))
      // A tab reads as its label in bold, then what it holds: `<TabItem label="pnpm">` → `**pnpm**`.
      .replace(/^[ \t]*<TabItem\b[^>]*>[ \t]*$/gm, (tag) => `**${attribute(tag, "label") ?? ""}**`)
      .replace(/^[ \t]*<\/TabItem>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<Tabs\b[^>]*>[ \t]*\n/gm, "")
      .replace(/^[ \t]*<\/Tabs>[ \t]*\n\n?/gm, "")
      .replace(/^[ \t]*<\/?(?:Flow|Steps|CardGrid)>[ \t]*\n/gm, "")
      .replace(/^\n+/, "")
  );
}

// `astro:content` is imported here, not at the top, so tests can call `pageMarkdown` outside an Astro build.
const render: MarkdownRenderer = async (entry) => {
  const body = entry.body ?? "";
  if (!body.includes("<PageList")) return pageMarkdown(body);
  const { getCollection } = await import("astro:content");
  return pageMarkdown(body, await getCollection("docs"));
};

export default render;
