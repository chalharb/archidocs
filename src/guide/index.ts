import { readFile } from "node:fs/promises";
import { ruleCatalogue } from "../core/catalogue.ts";
import { suggest } from "../core/suggest.ts";

/**
 * The authoring guide's Markdown, shipped beside the code in `guide/`. The
 * module runs from dist/guide/ when installed and from src/guide/ in this
 * repo; both sit two levels below the package root.
 */
const GUIDE_DIR = new URL("../../guide/", import.meta.url);

/** The skill's name, as its stub and the full SKILL.md both declare it. */
export const SKILL_NAME = "archidocs-authoring";

/** The guide's topics, in the order they are listed. `rules` is generated from the rule registry. */
export const topics = [
  { id: "bootstrap", summary: "Declare an existing codebase's Services, Relationships and Deployments in one pass, from an approved inventory." },
  { id: "add-service", summary: "Add one Service with its Components, Relationships and Deployments." },
  { id: "relationships", summary: "Declare a dependency, including async ones through a broker (`via`, `channel`) and cross-Project ones." },
  { id: "deployments", summary: "Add Deployment Targets and Deployments, with their URLs, per Environment." },
  { id: "dynamic-view", summary: "Draft a scenario as Steps over existing Relationships, adding missing ones." },
  { id: "saved-view", summary: "Save a structural or Deployment View with selectors and a Lens." },
  { id: "propose-adr", summary: "Propose an ADR linked to the Elements and Views it affects." },
  { id: "fill-gaps", summary: "Interview the user about the fields the Model leaves empty, proposing each value from evidence in the code and writing it as it is confirmed." },
  { id: "change", summary: "Rename, move or remove, working through refused removals by their references." },
  { id: "rules", summary: "Every `check` rule id: what it means, a failing example and the fix." },
] as const;

export type TopicId = (typeof topics)[number]["id"];

export type GuideResult =
  | { ok: true; topic: TopicId | null; text: string }
  | { ok: false; message: string; suggestion?: string };

/**
 * The guide as `get_authoring_guide` and `archidocs guide` serve it: with no
 * topic, SKILL.md followed by the list of topics; with one, that topic's
 * reference file.
 */
export async function authoringGuide(topic?: string): Promise<GuideResult> {
  if (topic === undefined) {
    const skill = await readFile(new URL("SKILL.md", GUIDE_DIR), "utf8");
    const list = ["## Topics", "", ...topics.map((t) => `- \`${t.id}\`: ${t.summary}`)];
    return { ok: true, topic: null, text: `${skill.trimEnd()}\n\n${list.join("\n")}\n` };
  }
  const found = topics.find((t) => t.id === topic);
  if (!found) {
    const suggestion = suggest(topic, topics.map((t) => t.id));
    return { ok: false, message: `Unknown topic "${topic}"${suggestion ? `; did you mean "${suggestion}"?` : ""} Topics: ${topics.map((t) => t.id).join(", ")}.`, ...(suggestion ? { suggestion } : {}) };
  }
  if (found.id === "rules") return { ok: true, topic: found.id, text: ruleCatalogue() };
  return { ok: true, topic: found.id, text: await readFile(new URL(`topics/${found.id}.md`, GUIDE_DIR), "utf8") };
}

/**
 * The thin SKILL.md that `archidocs init` installs in a repo, naming the
 * command that runs archidocs there (`runner`, such as `npx archidocs`). It
 * only points at the served guide, so it never goes stale, and uses only the
 * portable frontmatter fields.
 */
export const skillStub = (runner: string) => `---
name: ${SKILL_NAME}
description: Edit the Archidocs architecture Model. Use when bootstrapping a Project from code, adding or changing Services, Relationships, Deployments or Views, proposing an ADR, or finding and filling documentation gaps.
---

# Archidocs authoring

Before editing the Model, load the full guide: call the \`get_authoring_guide\` tool of the Archidocs MCP server, or run \`${runner} guide\` when no Archidocs MCP server is connected. It lists the topics; load the one for the task with \`get_authoring_guide(topic)\` or \`${runner} guide <topic>\`, and follow it.${runner === "archidocs" ? "" : ` In this repo, run every \`archidocs\` command as \`${runner}\`.`}
`;
