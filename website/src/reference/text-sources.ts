/**
 * Pages rendered from Markdown kept elsewhere in the repo, as it is, with
 * only its links rewritten: the agent guide (`guide/`), the glossary
 * (`GLOSSARY.md`) and the changelog (`CHANGELOG.md`).
 */
import { existsSync } from "node:fs";
import { skills, topics } from "../../../src/guide/index.ts";
import { GITHUB_URL, readRepoFile, repoPath } from "../lib/repo.ts";
import { blocks, splitTitle, stripFrontmatter, type GeneratedPage } from "./page.ts";

const GUIDE = "docs/reference/agent-guide";
const RULES = "/docs/reference/rules/";

const topicPath = (id: string) => (id === "rules" ? RULES : `/${GUIDE}/${id}/`);

/** The skills besides authoring, each a page of its own beside authoring's topics. */
const otherSkills = skills.filter((s) => s.id !== "authoring");

/**
 * Rewrites a repo Markdown file's links for the site: guide topics and the
 * glossary go to their pages, the `rules` topic to the rule reference, and
 * any other relative link to the file on GitHub.
 */
export function rewriteLinks(markdown: string, from: string): string {
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const linked = markdown.replace(/\]\(([^)\s]+)\)/g, (whole, href: string) => {
    if (/^[a-z]+:|^#|^\//i.test(href)) return whole;
    const [path = "", hash] = href.split("#");
    const resolved = new URL(path, `file:///${dir}`).pathname.slice(1);
    const topic = /^guide\/(?:topics\/([a-z-]+)\.md|([a-z-]+)\/SKILL\.md)$/.exec(resolved);
    const site = topic ? topicPath((topic[1] ?? topic[2])!) : resolved === "guide/SKILL.md" ? `/${GUIDE}/` : resolved === "GLOSSARY.md" ? "/docs/reference/glossary/" : undefined;
    const target = site ?? `${GITHUB_URL}/blob/main/${resolved}`;
    return `](${target}${hash ? `#${hash}` : ""})`;
  });
  // The guide names its generated `rules` topic in prose; on the site that topic is the rule reference.
  return linked.replace(/(?<!\[)the `rules` topic/g, `the [\`rules\` topic](${RULES})`);
}

const VERSION_NOTE =
  ":::note\nThis is the guide for the latest release. If you can run Archidocs, `archidocs guide` or the MCP `get_guide` tool serves the guide that matches your installed version.\n:::";

export function agentGuidePages(): GeneratedPage[] {
  const skill = splitTitle(stripFrontmatter(readRepoFile("guide/SKILL.md")));
  const index: GeneratedPage = {
    id: GUIDE,
    title: "Authoring guide for agents",
    label: "Overview",
    order: 0,
    description: "The guide agents load to edit the Model: the skill and its task topics.",
    source: "guide/SKILL.md",
    body: blocks(
      VERSION_NOTE,
      rewriteLinks(skill.rest, "guide/SKILL.md"),
      "## Topics",
      topics.map((t) => `- [\`${t.id}\`](${topicPath(t.id)}): ${t.summary}`).join("\n"),
      "## Other skills",
      "Skills of their own that build on authoring, each loaded with `get_guide(skill)` or `archidocs guide --skill <id>`.",
      otherSkills.map((s) => `- [\`${s.id}\`](${topicPath(s.id)}): ${s.description}`).join("\n"),
    ),
  };
  const pages = topics
    .filter((t) => t.id !== "rules")
    .map((t, i): GeneratedPage => {
      const source = `guide/topics/${t.id}.md`;
      const { title, rest } = splitTitle(readRepoFile(source));
      return {
        id: `${GUIDE}/${t.id}`,
        title: title ?? t.id,
        order: i + 1,
        description: t.summary,
        source,
        body: blocks(`Topic \`${t.id}\`: \`archidocs guide ${t.id}\` or \`get_guide("authoring", "${t.id}")\`.`, rewriteLinks(rest, source)),
      };
    });
  const skillPages = otherSkills.map((s, i): GeneratedPage => {
    const source = `guide/${s.dir}SKILL.md`;
    const { title, rest } = splitTitle(stripFrontmatter(readRepoFile(source)));
    return {
      id: `${GUIDE}/${s.id}`,
      title: title ?? s.id,
      order: topics.length + i + 1,
      description: s.description,
      source,
      body: blocks(`Skill \`${s.name}\`: \`archidocs guide --skill ${s.id}\` or \`get_guide("${s.id}")\`.`, rewriteLinks(rest, source)),
    };
  });
  return [index, ...pages, ...skillPages];
}

/** The anchor of a Glossary term, such as `term-deployment-target`, for hand-written pages to link to. */
export const termAnchor = (term: string): string => `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Gives each term (a line `**Term**:`) an anchor of its own, so a page can link to its entry. */
export function anchorTerms(markdown: string): string {
  return markdown.replace(/^\*\*([^*\n]+)\*\*:$/gm, (line, term: string) => `<span id="${termAnchor(term)}"></span>${line}`);
}

export function glossaryPage(): GeneratedPage {
  const { rest } = splitTitle(anchorTerms(readRepoFile("GLOSSARY.md")));
  return {
    id: "docs/reference/glossary",
    title: "Glossary",
    order: 1,
    description: "The terms Archidocs uses, each defined once.",
    source: "GLOSSARY.md",
    body: rewriteLinks(rest, "GLOSSARY.md"),
  };
}

export function changelogPage(): GeneratedPage {
  const releases = `${GITHUB_URL}/releases`;
  const exists = existsSync(repoPath("CHANGELOG.md"));
  return {
    id: "docs/reference/changelog",
    title: "Changelog",
    order: 2,
    description: "What changed in each release.",
    source: exists ? "CHANGELOG.md" : "release.config.mjs",
    body: exists ? rewriteLinks(splitTitle(readRepoFile("CHANGELOG.md")).rest, "CHANGELOG.md") : `Release notes are on [GitHub Releases](${releases}) until the changelog starts with the next release.\n`,
  };
}
