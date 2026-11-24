/**
 * A content loader that adds the generated reference pages to Starlight's
 * `docs` collection, beside the hand-written pages its own loader reads.
 * Generated pages live only in the content store: nothing is written to
 * disk, so nothing generated is ever committed.
 *
 * A generated page can have a hand-written intro: Markdown at
 * `src/intros/<page path>.md` (e.g. `src/intros/reference/model/model-yaml.md`)
 * is put before the generated body.
 */
import { existsSync, readFileSync } from "node:fs";
import type { Loader, LoaderContext } from "astro/loaders";
import { GITHUB_URL, WEBSITE_ROOT } from "../lib/repo.ts";
import { generatedPages } from "./index.ts";

const INTROS = new URL("src/intros/", WEBSITE_ROOT);

export function referenceLoader(docs: Loader): Loader {
  return {
    name: "archidocs-reference",
    async load(context: LoaderContext) {
      await docs.load(context);
      const pages = await generatedPages();
      const seen = new Set<string>();
      const ids = new Set(pages.map((p) => p.id));
      const hasChildren = (id: string) => [...ids].some((other) => other.startsWith(`${id}/`));
      for (const page of pages) {
        if (seen.has(page.id)) throw new Error(`Two generated pages have the id ${page.id}.`);
        if (context.store.has(page.id) && !context.store.get(page.id)?.data["generated"]) {
          throw new Error(`The generated page ${page.id} clashes with a hand-written page of the same path.`);
        }
        seen.add(page.id);
        const introFile = new URL(`${page.id.replace(/^docs\//, "")}.md`, INTROS);
        const intro = existsSync(introFile) ? readFileSync(introFile, "utf8").trim() : "";
        const body = intro ? `${intro}\n\n${page.body}` : page.body;
        // Where the page would sit if it were a file: Starlight's sidebar groups pages by it, and the
        // links validator checks a page's links by it. A page with pages below it is their folder's index.
        // `.mdx`, because the validator reads a `.md` file's frontmatter from disk to place an error.
        const filePath = `src/content/docs/${page.id}${hasChildren(page.id) ? "/index" : ""}.mdx`;
        const data = await context.parseData({
          id: page.id,
          filePath,
          data: {
            title: page.title,
            ...(page.description ? { description: plain(page.description) } : {}),
            sidebar: { ...(page.order !== undefined ? { order: page.order } : {}), ...(page.label ? { label: page.label } : {}) },
            editUrl: `${GITHUB_URL}/edit/main/${page.source}`,
            generated: true,
          },
        });
        context.store.set({ id: page.id, data, body, filePath, rendered: await context.renderMarkdown(body, { fileURL: new URL(filePath, WEBSITE_ROOT) }), digest: context.generateDigest({ data, body }) });
      }
    },
  };
}

/** A description for `<meta>` and search results: Markdown code spans unwrapped. */
const plain = (text: string): string => text.replace(/`([^`]*)`/g, "$1");
