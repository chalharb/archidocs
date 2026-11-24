/**
 * A Starlight plugin that gives Pagefind's heaviest weight to headings that
 * are an identifier: a CLI flag (`--all-saved`) or an MCP tool name
 * (`upsert_element`). With `PAGEFIND_RANKING`, searching an identifier then
 * finds the reference page where it is a heading first, before a guide page
 * that mentions it. Rule ids need nothing: each is its page's title.
 */
import type { StarlightPlugin } from "@astrojs/starlight/types";

/** A flag or a snake_case name, as a heading's whole text. */
export const IDENTIFIER = /^(?:--[a-z0-9]+(?:-[a-z0-9]+)*|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)$/;

interface HeadingContext {
  textContent(node: unknown): string;
  setProperty(node: unknown, key: string, value: unknown): void;
}

export const identifierHeadingsHastPlugin = {
  name: "archidocs-identifier-headings",
  element: {
    filter: ["h2", "h3"],
    visit(node: unknown, ctx: HeadingContext) {
      if (IDENTIFIER.test(ctx.textContent(node).trim())) ctx.setProperty(node, "dataPagefindWeight", "10");
    },
  },
};

export default function identifierHeadings(): StarlightPlugin {
  return {
    name: "archidocs-identifier-headings",
    hooks: {
      "config:setup"({ astroConfig }) {
        const processor = astroConfig.markdown.processor as { name?: string; options?: { hastPlugins?: unknown[] } } | undefined;
        if (processor?.name !== "satteri" || !Array.isArray(processor.options?.hastPlugins)) {
          throw new Error("The archidocs-identifier-headings plugin needs Astro's default Sätteri Markdown processor.");
        }
        processor.options.hastPlugins.push(identifierHeadingsHastPlugin);
      },
    },
  };
}
