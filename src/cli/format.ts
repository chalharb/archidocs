import type { Issue } from "../core/index.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** `--format text`: issues grouped by file, one per line, then a summary count. */
export function formatText(issues: Issue[]): string {
  const lines: string[] = [];
  let lastFile: string | undefined;
  for (const i of issues) {
    if (lastFile !== undefined && i.file !== lastFile) lines.push("");
    lastFile = i.file;
    const where = `${i.file}:${i.line}${i.column === undefined ? "" : `:${i.column}`}`;
    lines.push(`${where}  ${i.severity}  ${i.rule}  ${i.message}`);
  }
  const errors = issues.filter((i) => i.severity === "error").length;
  if (lines.length > 0) lines.push("");
  lines.push(`${plural(errors, "error")}, ${plural(issues.length - errors, "warning")}`);
  return lines.join("\n") + "\n";
}
