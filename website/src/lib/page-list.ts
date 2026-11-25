/**
 * The pages a group index page lists: the pages directly in one docs folder,
 * in the sidebar's order, each with its title and description. Read from the
 * docs collection, so a page added to the folder is on its group's index
 * without anyone editing the index.
 *
 * The `PageList` component draws the list on the page, and
 * `src/render-markdown.ts` writes the same list into the page's Markdown copy.
 */

/** As much of a docs collection entry as the list reads. */
export interface ListableEntry {
  id: string;
  data: {
    title: string;
    description?: string | undefined;
    draft?: boolean | undefined;
    sidebar?: { order?: number | undefined; hidden?: boolean | undefined } | undefined;
  };
}

export interface ListedPage {
  href: string;
  title: string;
  description: string;
}

const collator = new Intl.Collator("en");

/**
 * The pages directly in `directory` (a docs id such as `docs/concepts`),
 * without the folder's own index page, drafts and pages hidden from the
 * sidebar. Sorted as Starlight sorts a sidebar group: by `sidebar.order`,
 * then by id.
 */
export function listPages(entries: readonly ListableEntry[], directory: string): ListedPage[] {
  const prefix = `${directory}/`;
  const pages = entries
    .filter((entry) => entry.id.startsWith(prefix) && !entry.id.slice(prefix.length).includes("/"))
    .filter((entry) => !entry.data.draft && !entry.data.sidebar?.hidden)
    .sort((a, b) => (a.data.sidebar?.order ?? Infinity) - (b.data.sidebar?.order ?? Infinity) || collator.compare(a.id, b.id));
  if (pages.length === 0) throw new Error(`A page lists the pages in ${directory}, and there are none.`);
  return pages.map((entry) => {
    if (!entry.data.description) throw new Error(`The page ${entry.id} has no description, so the index that lists it has no line for it.`);
    return { href: `/${entry.id}/`, title: entry.data.title, description: entry.data.description };
  });
}

/** The list as Markdown, for the page's Markdown copy. */
export const pageListMarkdown = (pages: readonly ListedPage[]): string => pages.map((page) => `- [${page.title}](${page.href}): ${page.description}`).join("\n");
