import type { Files } from "./files.ts";
import { rules as registry, type RuleDefinition } from "./rules.ts";

/**
 * The rule catalogue as Markdown, generated from the rule registry: each
 * rule's id, severity, meaning, a failing example and the fix. Examples show
 * only the files the fix changes; paths are relative to the Workspace root.
 */
export function ruleCatalogue(rules: readonly RuleDefinition[] = registry): string {
  const out = [
    "# Check rules",
    "",
    "<!-- Generated from the rule registry in src/core/rules.ts by `pnpm rules:catalogue`. Do not edit by hand. -->",
    "",
    "`archidocs check` reports each issue with one of these rule ids. Errors fail the check; warnings fail it only with `--strict`.",
    "",
    "| Rule | Severity | Meaning |",
    "| --- | --- | --- |",
    ...rules.map((r) => `| [\`${r.id}\`](#${r.id}) | ${r.severity} | ${r.summary.replace(/\|/g, "\\|")} |`),
  ];
  for (const r of rules) {
    const { failing, passing } = r.example;
    out.push("", `## \`${r.id}\``, "", `**Severity:** ${r.severity}`, "", r.summary, "", "**Failing example**", "");
    out.push(...changedFiles(failing, passing).flatMap((path) => fileBlock(path, failing[path]!)));
    out.push(`**Fix:** ${r.fix}`, "", "**Fixed**", "");
    out.push(
      ...changedFiles(passing, failing).flatMap((path) => fileBlock(path, passing[path]!)),
      ...Object.keys(failing)
        .filter((path) => !(path in passing))
        .sort()
        .flatMap((path) => [`\`${path}\`: removed.`, ""]),
    );
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Paths in `files` whose text differs in (or is missing from) `other`. */
const changedFiles = (files: Files, other: Files) =>
  Object.keys(files)
    .filter((path) => files[path] !== other[path])
    .sort();

const fileBlock = (path: string, text: string) => [`\`${path}\`:`, "", path.endsWith(".md") ? "````markdown" : "```yaml", text.trimEnd(), path.endsWith(".md") ? "````" : "```", ""];
