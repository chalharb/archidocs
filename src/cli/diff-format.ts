import { countChanges, type Change, type ChangeKind } from "../core/index.ts";
import type { DiffSide } from "../commands/index.ts";

export const diffFormats = ["text", "json", "markdown"] as const;
export type DiffFormat = (typeof diffFormats)[number];

export function formatDiff(changes: Change[], from: DiffSide, to: DiffSide, format: DiffFormat): string {
  if (format === "json") return JSON.stringify({ from, to, counts: countChanges(changes), changes }, null, 2) + "\n";
  return format === "markdown" ? markdown(changes, from, to) : text(changes, from, to);
}

const kindNames: Record<ChangeKind, string> = {
  team: "Team",
  environment: "Environment",
  project: "Project",
  element: "Element",
  relationship: "Relationship",
  target: "Deployment Target",
  deployment: "Deployment",
  view: "Saved View",
  adr: "ADR",
};

const label = (side: DiffSide) => (side.commit === null ? side.point : side.commit.startsWith(side.point) ? side.commit.slice(0, 7) : `${side.point} (${side.commit.slice(0, 7)})`);

const summary = (changes: Change[]) => {
  const { added, removed, changed } = countChanges(changes);
  return `${added} added, ${removed} removed, ${changed} changed`;
};

/** A field's before and after, or just that it changed for an ADR's body. */
const fieldLines = (c: Change, value: (v: unknown) => string) =>
  c.fields.map((f) => (c.kind === "adr" && f === "body" ? "body changed" : `${f}: ${value(c.before![f])} → ${value(c.after![f])}`));

const sign = { added: "+", removed: "-", changed: "~" } as const;

function text(changes: Change[], from: DiffSide, to: DiffSide): string {
  const lines = [`Changes from ${label(from)} to ${label(to)}: ${summary(changes)}`];
  if (changes.length > 0) lines.push("");
  for (const c of changes) {
    lines.push(`${sign[c.type]} ${kindNames[c.kind]} ${c.id}`);
    for (const line of fieldLines(c, (v) => JSON.stringify(v))) lines.push(`    ${line}`);
  }
  return lines.join("\n") + "\n";
}

function markdown(changes: Change[], from: DiffSide, to: DiffSide): string {
  const code = (s: string) => `\`${s.replace(/`/g, "'")}\``;
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const lines = [`### Model changes ${code(label(from))} → ${code(label(to))}`, ""];
  if (changes.length === 0) return [...lines, "No Model changes.", ""].join("\n");
  lines.push(`${summary(changes)}.`, "", "| Change | Kind | Id | Fields |", "| --- | --- | --- | --- |");
  for (const c of changes) {
    const fields = fieldLines(c, (v) => code(JSON.stringify(v))).join("<br>");
    lines.push(`| ${c.type} | ${kindNames[c.kind]} | ${cell(code(c.id))} | ${cell(fields)} |`);
  }
  return lines.join("\n") + "\n";
}
