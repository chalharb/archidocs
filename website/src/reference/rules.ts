/**
 * The check rule pages, from the rule registry in `src/core/rules.ts`: an
 * index, a page per rule at `/docs/reference/rules/<rule-id>/` (the URL
 * `check` output links to), and a stub per removed rule so the links older
 * CLIs print keep working.
 */
import type { Files } from "../../../src/core/files.ts";
import { removed as removedRules, rules as registry, type RemovedRule, type RuleDefinition } from "../../../src/core/rules.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/rules";
const SOURCE = "src/core/rules.ts";

export const rulePath = (id: string): string => `/${BASE}/${id}/`;

export function rulePages(rules: readonly RuleDefinition[] = registry, removed: readonly RemovedRule[] = removedRules): GeneratedPage[] {
  return [indexPage(rules, removed), ...rules.map(rulePage), ...removed.map((r) => removedPage(r, rules))];
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
      "`archidocs check` reports each issue with one of these rule ids, and links to the rule's page. Errors fail the check; warnings fail it only with `--strict`.",
      table(
        ["Rule", "Severity", "Meaning"],
        rules.map((r) => [`[\`${r.id}\`](${rulePath(r.id)})`, r.severity, text(r.summary)]),
      ),
      removed.length > 0 && "## Removed rules",
      removed.length > 0 && table(["Rule", "Removed in", "Replaced by"], removed.map((r) => [`[\`${r.id}\`](${rulePath(r.id)})`, `v${r.removedIn}`, replacement(r, rules)])),
    ),
  };
}

function rulePage(rule: RuleDefinition): GeneratedPage {
  const { failing, passing } = rule.example;
  const deleted = Object.keys(failing)
    .filter((path) => !(path in passing))
    .sort();
  return {
    id: `${BASE}/${rule.id}`,
    title: rule.id,
    description: rule.summary,
    source: SOURCE,
    body: blocks(
      `**Severity:** ${rule.severity}`,
      text(rule.summary),
      "## Failing example",
      ...changedFiles(failing, passing).map((path) => fileBlock(path, failing[path]!)),
      "## Fix",
      text(rule.fix),
      "## Fixed",
      ...changedFiles(passing, failing).map((path) => fileBlock(path, passing[path]!)),
      ...deleted.map((path) => `\`${path}\`: removed.`),
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

/** A removed rule's replacement, linked when it names a current rule. */
const replacement = (rule: RemovedRule, rules: readonly RuleDefinition[]): string =>
  rules.some((r) => r.id === rule.replacement) ? `[\`${rule.replacement}\`](${rulePath(rule.replacement)})` : rule.replacement;

/** Paths in `files` whose text differs in (or is missing from) `other`: the files an example's fix touches. */
const changedFiles = (files: Files, other: Files): string[] =>
  Object.keys(files)
    .filter((path) => files[path] !== other[path])
    .sort();

const fileBlock = (path: string, text: string): string => `\`${path}\`:\n\n${fence(path.endsWith(".md") ? "markdown" : "yaml", text)}`;
