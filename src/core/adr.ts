import { ADR_FILENAME, AdrRef } from "../schema/adr.ts";
import type { AdrDecl, Project } from "./model.ts";
import { parseYaml } from "./yaml.ts";

/** The file a Project's ADR template lives in, inside its `adr/` folder; it is not an ADR. */
export const PROJECT_TEMPLATE = "template.md";
/** The Workspace's ADR template, beside `workspace.yaml`. */
export const WORKSPACE_TEMPLATE = "adr-template.md";

/** Splits markdown into its frontmatter YAML (between `---` lines at the top) and the rest. */
export function splitFrontmatter(text: string): { yaml?: string; body: string; bodyLine: number } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { body: text, bodyLine: 1 };
  const end = lines.findIndex((l, i) => i > 0 && (l.trim() === "---" || l.trim() === "..."));
  if (end === -1) return { body: text, bodyLine: 1 };
  let start = end + 1;
  while (start < lines.length - 1 && lines[start]!.trim() === "") start++;
  return { yaml: lines.slice(1, end).join("\n") + "\n", body: lines.slice(start).join("\n"), bodyLine: start + 1 };
}

/** The first `# ` heading outside a fenced code block, with its 1-based line within `body`. */
function firstHeading(body: string): { text: string; line: number } | undefined {
  let fenced = false;
  for (const [i, line] of body.split(/\r?\n/).entries()) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && /^# +(.*\S)\s*$/.exec(line);
    if (m) return { text: m[1]!, line: i + 1 };
  }
  return undefined;
}

/** Reads one ADR file: its number, frontmatter and title. */
export function readAdr(text: string, at: { project: Project; path: string; filename: string }): AdrDecl {
  const { yaml, body, bodyLine } = splitFrontmatter(text);
  const frontmatter = yaml === undefined ? undefined : parseYaml(yaml);
  const data = frontmatter?.data;
  const heading = firstHeading(body);
  return {
    ...at,
    ...(ADR_FILENAME.test(at.filename) ? { number: at.filename.slice(0, 4) } : {}),
    ...(frontmatter ? { frontmatter } : {}),
    lineOffset: 1,
    data: data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {},
    ...(heading ? { title: { text: heading.text, line: heading.line + bodyLine - 1 } } : {}),
    body,
    bodyLine,
  };
}

/** An ADR reference written in `project`, qualified as `project:NNNN`; undefined when malformed or the Project has no id. */
export function qualifyAdr(ref: unknown, project: Project): string | undefined {
  if (!AdrRef.safeParse(ref).success) return undefined;
  const text = ref as string;
  if (text.includes(":")) return text;
  return project.id === undefined ? undefined : `${project.id}:${text}`;
}

/** The default template: MADR minimal. */
export const MADR_MINIMAL = `---
status: proposed
date: {{date}}
---

# {{title}}

## Context and Problem Statement

{Describe the context and problem statement in two or three sentences.}

## Considered Options

* {title of option 1}
* {title of option 2}

## Decision Outcome

Chosen option: "{title of option 1}", because {justification}.

### Consequences

* Good, because {positive consequence}
* Bad, because {negative consequence}
`;

/** Fills a template's `{{title}}`, `{{date}}`, `{{elements}}` and `{{views}}`; lists are comma-separated. */
export function fillTemplate(template: string, values: { title: string; date: string; elements: readonly string[]; views: readonly string[] }): string {
  const fill: Record<string, string> = { title: values.title, date: values.date, elements: values.elements.join(", "), views: values.views.join(", ") };
  return template.replace(/\{\{\s*(title|date|elements|views)\s*\}\}/g, (_, key: string) => fill[key]!);
}
