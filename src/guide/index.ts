import { readFile } from "node:fs/promises";
import { ruleCatalogue } from "../core/catalogue.ts";
import { suggest } from "../core/suggest.ts";

/**
 * The skills' guides, as Markdown shipped beside the code in `guide/`. The
 * module runs from dist/guide/ when installed and from src/guide/ in this
 * repo; both sit two levels below the package root.
 */
const GUIDE_DIR = new URL("../../guide/", import.meta.url);

/** The authoring guide's topics, in the order they are listed. `rules` is generated from the rule registry. */
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

/** A skill's topic: a reference file under its guide folder's `topics/`, or a generated one. */
export interface Topic {
  readonly id: string;
  readonly summary: string;
}

/** One agent skill: the stub `init` installs, and the guide `get_guide` serves. */
export interface Skill {
  readonly id: string;
  /** The stub's frontmatter `name`: `archidocs-<id>`, since `.agents/skills/` has no namespace. */
  readonly name: string;
  /** The stub's frontmatter `description`, which decides when the skill fires. */
  readonly description: string;
  /** The folder under `guide/` that holds its SKILL.md (and `topics/`), with a trailing slash; `""` for authoring. */
  readonly dir: string;
  readonly topics?: readonly Topic[];
}

/** Every skill, authoring first. */
export const skills = [
  {
    id: "authoring",
    name: "archidocs-authoring",
    description:
      "Edit the Archidocs architecture Model. Use when bootstrapping a Project from code, adding or changing Services, Relationships, Deployments or Views, proposing an ADR, or finding and filling documentation gaps.",
    dir: "",
    topics,
  },
] as const satisfies readonly Skill[];

export type SkillId = (typeof skills)[number]["id"];

/** The authoring skill's name, as its stub and the full SKILL.md both declare it. */
export const SKILL_NAME = skills[0].name;

export type GuideResult =
  | { ok: true; skill: string; topic: string | null; text: string }
  | { ok: false; message: string; suggestion?: string };

/**
 * A skill's guide as `get_guide` and `archidocs guide --skill` serve it: with
 * no topic, its SKILL.md, followed by its list of topics if it has any; with
 * one, that topic's reference file. An unknown skill names the closest one.
 */
export async function guide(skill: string, topic?: string): Promise<GuideResult> {
  const found = skills.find((s) => s.id === skill);
  if (!found) {
    const ids = skills.map((s) => s.id);
    const suggestion = suggest(skill, ids);
    return { ok: false, message: `Unknown skill "${skill}"${suggestion ? `; did you mean "${suggestion}"?` : ""} Skills: ${ids.join(", ")}.`, ...(suggestion ? { suggestion } : {}) };
  }
  return skillGuide(found, topic);
}

/** One skill's guide, for `guide` once the skill is found. */
export async function skillGuide(skill: Skill, topic?: string): Promise<GuideResult> {
  const own = skill.topics ?? [];
  if (topic === undefined) {
    const text = (await readFile(new URL(`${skill.dir}SKILL.md`, GUIDE_DIR), "utf8")).trimEnd();
    const list = own.length ? ["", "", "## Topics", "", ...own.map((t) => `- \`${t.id}\`: ${t.summary}`)].join("\n") : "";
    return { ok: true, skill: skill.id, topic: null, text: `${text}${list}\n` };
  }
  if (!own.length) return { ok: false, message: `The skill "${skill.id}" has no topics; load it with no topic.` };
  const found = own.find((t) => t.id === topic);
  if (!found) {
    const suggestion = suggest(topic, own.map((t) => t.id));
    return { ok: false, message: `Unknown topic "${topic}"${suggestion ? `; did you mean "${suggestion}"?` : ""} Topics: ${own.map((t) => t.id).join(", ")}.`, ...(suggestion ? { suggestion } : {}) };
  }
  if (skill.id === "authoring" && found.id === "rules") return { ok: true, skill: skill.id, topic: found.id, text: ruleCatalogue() };
  return { ok: true, skill: skill.id, topic: found.id, text: await readFile(new URL(`${skill.dir}topics/${found.id}.md`, GUIDE_DIR), "utf8") };
}

/** The authoring guide, as `get_authoring_guide` and `archidocs guide` without `--skill` serve it. */
export const authoringGuide = (topic?: string): Promise<GuideResult> => guide("authoring", topic);

const titleOf = (id: string) => `Archidocs ${id.replaceAll("-", " ")}`;

/**
 * The thin SKILL.md that `archidocs init` installs in a repo for one skill,
 * naming the command that runs archidocs there (`runner`, such as `npx
 * archidocs`). It only points at the served guide, so it never goes stale, and
 * uses only the portable frontmatter fields.
 */
export function skillStub(id: SkillId, runner: string): string {
  const skill: Skill = skills.find((s) => s.id === id)!;
  const cli = (args: string) => `\`${runner} guide ${args}\``;
  const load =
    skill.id === "authoring"
      ? `Before editing the Model, load the full guide: call \`get_guide("authoring")\` on the Archidocs MCP server (\`get_authoring_guide\` on a server older than \`get_guide\`), or run ${cli("--skill authoring")} when no Archidocs MCP server is connected. It lists the topics; load the one for the task with \`get_guide("authoring", topic)\` or ${cli("<topic> --skill authoring")}, and follow it.`
      : `Before you start, load the full guide: call \`get_guide("${skill.id}")\` on the Archidocs MCP server, or run ${cli(`--skill ${skill.id}`)} when no Archidocs MCP server is connected, and follow it.`;
  return `---
name: ${skill.name}
description: ${skill.description}
---

# ${titleOf(skill.id)}

${load}${runner === "archidocs" ? "" : ` In this repo, run every \`archidocs\` command as \`${runner}\`.`}
`;
}
