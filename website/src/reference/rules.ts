/**
 * The check rule pages, from the rule registry in `src/core/rules.ts`: an
 * index grouped by area, a page per rule at `/docs/reference/rules/<rule-id>/`
 * (the URL `check` output links to), and a stub per removed rule so the links
 * older CLIs print keep working.
 *
 * Each rule page shows what `check` prints for the rule's failing example.
 * The build runs the check itself, over the example held in memory, so the
 * line on the page is always the one the CLI prints.
 */
import { join, resolve } from "node:path";
import { formatText } from "../../../src/cli/format.ts";
import type { Files } from "../../../src/core/files.ts";
import type { FileSystem } from "../../../src/core/fs.ts";
import { load } from "../../../src/core/load.ts";
import type { Issue } from "../../../src/core/model.ts";
import { removed as removedRules, ruleAreas, rules as registry, type RemovedRule, type RuleArea, type RuleDefinition } from "../../../src/core/rules.ts";
import { overlayFileSystem } from "../../../src/writer/overlay.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/rules";
const SOURCE = "src/core/rules.ts";

export const rulePath = (id: string): string => `/${BASE}/${id}/`;

/** Each area's heading on the index, and what its rules are about. */
const areas: Record<RuleArea, { title: string; covers: string }> = {
  workspace: { title: "Workspace", covers: "Files that parse and fit the schema, Projects, Teams and Qualified ids." },
  elements: { title: "Elements", covers: "Declaring Elements, nesting them, and naming them from elsewhere." },
  relationships: { title: "Relationships", covers: "Which Elements a Relationship may connect, and how an async one names its broker." },
  deployments: { title: "Deployments", covers: "Deployments, and the Environments and Deployment Targets they name." },
  views: { title: "Views", covers: "Saved Views and Dynamic View Steps that resolve against the Model, and Views too big or too empty to read." },
  decisions: { title: "Decisions", covers: "ADR files, their links to the Model, and which ADR supersedes which." },
};

export async function rulePages(rules: readonly RuleDefinition[] = registry, removed: readonly RemovedRule[] = removedRules): Promise<GeneratedPage[]> {
  const reported = await Promise.all(rules.map((rule) => checkExample(rule.example.failing)));
  return [indexPage(rules, removed), ...rules.map((rule, i) => rulePage(rule, reported[i]!, rules)), ...removed.map((r) => removedPage(r, rules))];
}

function indexPage(rules: readonly RuleDefinition[], removed: readonly RemovedRule[]): GeneratedPage {
  return {
    id: BASE,
    title: "Check rules",
    label: "All rules",
    order: 0,
    description: "Every rule `archidocs check` reports, with its severity and what it means.",
    source: SOURCE,
    body: blocks(
      "`archidocs check` reports each issue with one of these rule ids, and links to the rule's page. Errors fail the check; warnings fail it only with `--strict`. The rules are grouped by the part of the Model they are about.",
      ...ruleAreas.flatMap((area) => {
        const inArea = rules.filter((r) => r.area === area);
        if (inArea.length === 0) return [];
        return [
          `## ${areas[area].title}`,
          areas[area].covers,
          table(
            ["Rule", "Severity", "Meaning"],
            inArea.map((r) => [ruleLink(r.id), r.severity, text(r.summary)]),
          ),
        ];
      }),
      removed.length > 0 && "## Removed rules",
      removed.length > 0 && table(["Rule", "Removed in", "Replaced by"], removed.map((r) => [ruleLink(r.id), `v${r.removedIn}`, replacement(r, rules)])),
    ),
  };
}

/** A rule's page. `reported` is every issue `check` reports for its failing example. */
function rulePage(rule: RuleDefinition, reported: readonly Issue[], rules: readonly RuleDefinition[]): GeneratedPage {
  const { failing, passing } = rule.example;
  const deleted = Object.keys(failing)
    .filter((path) => !(path in passing))
    .sort();
  const own = reported.filter((i) => i.rule === rule.id);
  if (own.length === 0) throw new Error(`The failing example of the rule ${rule.id} doesn't report it, so its page has no line to show.`);
  const others = [...new Set(reported.filter((i) => i.rule !== rule.id).map((i) => i.rule))];
  // The files the fix changes, and any other file a reported line points into, so every line shown can be found on the page.
  const shown = [...new Set([...changedFiles(failing, passing), ...own.map((i) => i.file).filter((path) => path in failing)])].sort();
  const related = (rule.related ?? []).map((id) => {
    const other = rules.find((r) => r.id === id);
    if (!other) throw new Error(`The rule ${rule.id} lists "${id}" in \`related\`, which is no current rule.`);
    return other;
  });
  return {
    id: `${BASE}/${rule.id}`,
    title: rule.id,
    description: rule.summary,
    source: SOURCE,
    body: blocks(
      text(rule.summary),
      `**Severity:** ${rule.severity} · **Since:** v${rule.since}`,
      "## What `check` reports",
      "For the [failing example](#failing-example) below, `archidocs check` prints:",
      fence("text", own.map(issueLine).join("\n")),
      others.length > 0 && `The same example also reports ${others.map(ruleLink).join(", ")}.`,
      "## Why",
      text(rule.why),
      "## Failing example",
      ...shown.map((path) => fileBlock(path, failing[path]!)),
      "## Fix",
      text(rule.fix),
      "## Fixed",
      ...changedFiles(passing, failing).map((path) => fileBlock(path, passing[path]!)),
      ...deleted.map((path) => `\`${path}\`: removed.`),
      related.length > 0 && "## Related rules",
      related.map((r) => `- ${ruleLink(r.id)}: ${text(r.summary)}`).join("\n"),
    ),
  };
}

function removedPage(rule: RemovedRule, rules: readonly RuleDefinition[]): GeneratedPage {
  return {
    id: `${BASE}/${rule.id}`,
    title: rule.id,
    description: `A check rule removed in v${rule.removedIn}.`,
    source: SOURCE,
    body: blocks(
      `Archidocs v${rule.removedIn} removed this rule, so newer releases never report it. You see this page because an older CLI linked to it.`,
      `**Replaced by:** ${replacement(rule, rules)}`,
      `See [every current rule](/${BASE}/).`,
    ),
  };
}

const ruleLink = (id: string): string => `[\`${id}\`](${rulePath(id)})`;

/** A removed rule's replacement, linked when it names a current rule. */
const replacement = (rule: RemovedRule, rules: readonly RuleDefinition[]): string =>
  rules.some((r) => r.id === rule.replacement) ? ruleLink(rule.replacement) : rule.replacement;

/** Paths in `files` whose text differs in (or is missing from) `other`: the files an example's fix touches. */
const changedFiles = (files: Files, other: Files): string[] =>
  Object.keys(files)
    .filter((path) => files[path] !== other[path])
    .sort();

const fileBlock = (path: string, text: string): string => `\`${path}\`:\n\n${fence(path.endsWith(".md") ? "markdown" : "yaml", text)}`;

/** A file system with nothing in it, for an example's files to be laid over. */
const nothing: FileSystem = {
  readFile: async (path) => {
    throw new Error(`No file at ${path}.`);
  },
  readDir: async () => [],
  exists: async () => false,
};

/** Where an example's Workspace sits in memory. It is its own repo root, so `check` reports the paths the page shows, relative to the Workspace root. */
const EXAMPLE_ROOT = resolve("/archidocs-rule-example");

/** The issues `archidocs check` reports for an example Workspace, in the order it prints them. The files are read from memory: nothing touches disk. */
export async function checkExample(files: Files): Promise<Issue[]> {
  const inMemory = new Map(Object.entries(files).map(([path, text]) => [join(EXAMPLE_ROOT, ...path.split("/")), text]));
  const { issues } = await load({ fs: overlayFileSystem(nothing, inMemory), root: EXAMPLE_ROOT, repoRoot: EXAMPLE_ROOT });
  return issues;
}

/** An issue as `check --format text` prints it: `path:line:column  severity  rule  message`. */
const issueLine = (issue: Issue): string => formatText([issue]).split("\n")[0]!;
