import { ruleDocsUrl, withDocs, type Issue } from "../core/index.ts";

export const formats = ["text", "json", "github"] as const;
export type Format = (typeof formats)[number];

export interface FormatOptions {
  /** Colour the text format; only when writing to a terminal. */
  color?: boolean;
}

/** Writes issues in the chosen `--format`. */
export function formatIssues(issues: Issue[], format: Format, options: FormatOptions = {}): string {
  if (format === "json") return formatJson(issues);
  if (format === "github") return formatGithub(issues);
  return formatText(issues, options);
}

/** Exit code for a finished check: 1 on any error, or on any warning with `--strict`; else 0. */
export function exitCodeFor(issues: Issue[], { strict = false }: { strict?: boolean } = {}): 0 | 1 {
  return issues.some((i) => strict || i.severity === "error") ? 1 : 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function summarize(issues: Issue[]) {
  const errors = issues.filter((i) => i.severity === "error").length;
  return { errors, warnings: issues.length - errors };
}

const ansi = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[0m`;
const plain = (s: string) => s;

/** `--format text`: issues grouped by file, one per line, then a summary count and each distinct rule's docs link. */
export function formatText(issues: Issue[], { color = false }: FormatOptions = {}): string {
  const red = color ? ansi(31) : plain;
  const yellow = color ? ansi(33) : plain;
  const dim = color ? ansi(2) : plain;
  const lines: string[] = [];
  let lastFile: string | undefined;
  for (const i of issues) {
    if (lastFile !== undefined && i.file !== lastFile) lines.push("");
    lastFile = i.file;
    const where = `${i.file}:${i.line}${i.column === undefined ? "" : `:${i.column}`}`;
    const severity = i.severity === "error" ? red(i.severity) : yellow(i.severity);
    lines.push(`${where}  ${severity}  ${dim(i.rule)}  ${i.message}`);
  }
  const { errors, warnings } = summarize(issues);
  if (lines.length > 0) lines.push("");
  lines.push(`${plural(errors, "error")}, ${plural(warnings, "warning")}`);
  const ruleIds = [...new Set(issues.map((i) => i.rule))];
  if (ruleIds.length > 0) lines.push("", "Rule docs:", ...ruleIds.map((id) => `  ${dim(id)}  ${ruleDocsUrl(id)}`));
  return lines.join("\n") + "\n";
}

/** `--format json`: the issue records with their rule's `docs` link, as MCP returns them, and a summary. */
function formatJson(issues: Issue[]): string {
  return JSON.stringify({ issues: issues.map(withDocs), summary: summarize(issues) }, null, 2) + "\n";
}

// GitHub workflow command escaping: https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
const escapeData = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (s: string) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

/** `--format github`: one `::error`/`::warning` workflow command per issue, for inline PR annotations, ending with its rule's docs link. */
function formatGithub(issues: Issue[]): string {
  return issues
    .map((i) => {
      const props = [`file=${escapeProperty(i.file)}`, `line=${i.line}`];
      if (i.column !== undefined) props.push(`col=${i.column}`);
      props.push(`title=${escapeProperty(i.rule)}`);
      return `::${i.severity} ${props.join(",")}::${escapeData(`${i.message} See ${ruleDocsUrl(i.rule)}`)}\n`;
    })
    .join("");
}
