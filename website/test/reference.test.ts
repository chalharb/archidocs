import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { commandList, NO_WORKSPACE, parseCommandLine, type CommandDefinition } from "../../src/cli/commands.ts";
import type { Files } from "../../src/core/files.ts";
import { ruleAreas, rules } from "../../src/core/rules.ts";
import { topics } from "../../src/guide/index.ts";
import { archidocsArgs, checkMarkdown } from "../src/lib/command-lines.ts";
import { repoPath } from "../src/lib/repo.ts";
import { cliPages, commandPath, handWrittenFile, SEE_ALSO, WORKSPACE_SECTION } from "../src/reference/cli.ts";
import { generatedPages } from "../src/reference/index.ts";
import { listTools, mcpPages } from "../src/reference/mcp.ts";
import { modelPages } from "../src/reference/model.ts";
import { rulePages } from "../src/reference/rules.ts";
import { anchorTerms, glossaryPage, rewriteLinks, termAnchor } from "../src/reference/text-sources.ts";

const byId = async () => new Map((await generatedPages()).map((p) => [p.id, p]));

/** Every rule id a release has shipped (v1.0.0 to v1.2.0). Released CLIs print these rules' URLs, so each keeps a page for good. */
const releasedRuleIds = [
  "yaml-syntax",
  "unknown-field",
  "missing-field",
  "invalid-value",
  "nested-project",
  "file-outside-project",
  "duplicate-project-id",
  "definition-outside-workspace",
  "unknown-team",
  "duplicate-id",
  "invalid-nesting",
  "external-with-components",
  "unknown-element",
  "unknown-project",
  "own-project-prefix",
  "duplicate-relationship-id",
  "self-relationship",
  "person-as-provider",
  "ancestor-descendant-relationship",
  "via-on-sync",
  "via-not-broker",
  "duplicate-deployment",
  "unknown-environment",
  "unknown-target",
  "wrong-kind",
  "oversized-view",
  "duplicate-view-id",
  "missing-step",
  "ambiguous-step",
  "return-without-relationship",
  "return-on-async",
  "ancestor-descendant-participants",
  "target-outside-environment",
  "bad-expand",
  "empty-view",
  "unresolved-path",
  "invalid-adr-frontmatter",
  "missing-adr-title",
  "bad-adr-filename",
  "duplicate-adr-number",
  "unknown-adr-link",
  "hand-written-superseded",
  "supersedes-cycle",
  "superseded-twice",
  "supersedes-unaccepted",
];

/** The lines under a rule page's "What `check` reports". */
const reportedLines = (body: string): string[] => /^## What `check` reports\n\n[^\n]+\n\n```text\n([\s\S]*?)\n```$/m.exec(body)?.[1]?.split("\n") ?? [];

/** A page's `## ` headings, in order. */
const headings = (body: string): string[] => [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);

/** A page's Markdown with the `<` that `text()` escaped put back, to compare with the registry's own text. */
const unescaped = (markdown: string): string => markdown.replace(/&lt;/g, "<");

/** The issue lines the CLI itself prints for a Workspace: `archidocs check`, run in a temp folder that is its own repo root. */
async function cliIssueLines(files: Files): Promise<string[]> {
  const root = mkdtempSync(join(tmpdir(), "archidocs-rule-"));
  mkdirSync(join(root, ".git"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const { stdout } = await promisify(execFile)(process.execPath, [repoPath("src/cli/main.ts"), "check"], { cwd: root }).catch((error: { stdout: string; code: number }) => {
    if (error.code !== 1) throw error;
    return error;
  });
  // The issue lines come first; the count ("1 error, 0 warnings") ends them.
  const lines = stdout.split("\n");
  return lines.slice(0, lines.findIndex((line) => /^\d+ errors?, \d+ warnings?$/.test(line))).filter((line) => line !== "");
}

describe("generated reference pages", () => {
  it("gives every rule in the registry a page titled with its id, and lists it on the index", async () => {
    const pages = await byId();
    const index = pages.get("docs/reference/rules")!;
    for (const rule of rules) {
      expect(pages.get(`docs/reference/rules/${rule.id}`)?.title).toBe(rule.id);
      expect(index.body).toContain(`(/docs/reference/rules/${rule.id}/)`);
    }
  });

  it("keeps a page for every rule id a release has shipped, as a rule or as a removed rule's stub", async () => {
    const pages = await byId();
    for (const id of releasedRuleIds) expect(pages.has(`docs/reference/rules/${id}`), id).toBe(true);
  });

  it("shows on every rule page the lines the CLI prints for its failing example", async () => {
    const pages = await byId();
    const printed = await Promise.all(rules.map((rule) => cliIssueLines(rule.example.failing)));
    for (const [i, rule] of rules.entries()) {
      const shown = reportedLines(pages.get(`docs/reference/rules/${rule.id}`)!.body);
      expect(shown.length, rule.id).toBeGreaterThan(0);
      expect(shown, rule.id).toEqual(printed[i]!.filter((line) => line.includes(`  ${rule.id}  `)));
      for (const line of shown) expect(line, rule.id).toMatch(new RegExp(`^\\S+:\\d+(:\\d+)?  ${rule.severity}  ${rule.id}  \\S`));
    }
  });

  it("shows, in the failing example, every file a reported line points into", async () => {
    const pages = await byId();
    for (const rule of rules) {
      const { body } = pages.get(`docs/reference/rules/${rule.id}`)!;
      const example = body.slice(body.indexOf("## Failing example"), body.indexOf("## Fix"));
      for (const line of reportedLines(body)) expect(example, rule.id).toContain(`\`${line.slice(0, line.indexOf(":"))}\`:`);
    }
  });

  it("orders a rule page: summary, severity and since, what check reports, why, the example, the fix, related rules", async () => {
    const pages = await byId();
    for (const rule of rules) {
      const { body } = pages.get(`docs/reference/rules/${rule.id}`)!;
      expect(body.split("\n\n").slice(0, 2).map(unescaped), rule.id).toEqual([rule.summary, `**Severity:** ${rule.severity} · **Since:** v${rule.since}`]);
      expect(headings(body), rule.id).toEqual(["What `check` reports", "Why", "Failing example", "Fix", "Fixed", ...(rule.related?.length ? ["Related rules"] : [])]);
      expect(unescaped(body.slice(body.indexOf("## Why"), body.indexOf("## Failing example"))), rule.id).toContain(rule.why);
      for (const id of rule.related ?? []) expect(body.slice(body.indexOf("## Related rules")), rule.id).toContain(`(/docs/reference/rules/${id}/)`);
    }
  });

  it("names the other rules a failing example also reports", async () => {
    const { body } = (await byId()).get("docs/reference/rules/unresolved-path")!;
    expect(body).toContain("The same example also reports [`empty-view`](/docs/reference/rules/empty-view/).");
  });

  it("groups the index by area, one table each, with every rule in exactly one", async () => {
    const index = (await byId()).get("docs/reference/rules")!.body;
    const sections = index.split(/^## /m).slice(1);
    expect(sections.map((s) => s.slice(0, s.indexOf("\n")))).toEqual(["Workspace", "Elements", "Relationships", "Deployments", "Views", "Decisions"]);
    for (const [i, area] of ruleAreas.entries()) {
      const linked = [...sections[i]!.matchAll(/\(\/docs\/reference\/rules\/([a-z-]+)\/\)/g)].map((m) => m[1]);
      expect(linked, area).toEqual(rules.filter((r) => r.area === area).map((r) => r.id));
      expect(sections[i]!.match(/^\| Rule \| Severity \| Meaning \|$/gm), area).toHaveLength(1);
    }
  });

  it("fails the build when a failing example doesn't report its rule, or a related id names no rule", async () => {
    const [rule] = rules;
    await expect(rulePages([{ ...rule!, example: { failing: rule!.example.passing, passing: rule!.example.passing } }], [])).rejects.toThrow(/doesn't report it/);
    await expect(rulePages([{ ...rule!, related: ["no-such-rule"] }], [])).rejects.toThrow(/no-such-rule/);
  });

  it("keeps a stub page for each removed rule, linking its replacement", async () => {
    const [current] = rules;
    const pages = await rulePages(rules, [
      { id: "old-rule", removedIn: "1.4.0", replacement: current!.id },
      { id: "older-rule", removedIn: "1.2.0", replacement: "Nothing replaces it." },
    ]);
    const stub = pages.find((p) => p.id === "docs/reference/rules/old-rule")!;
    expect(stub.body).toContain("v1.4.0");
    expect(stub.body).toContain(`(/docs/reference/rules/${current!.id}/)`);
    expect(pages.find((p) => p.id === "docs/reference/rules/older-rule")!.body).toContain("Nothing replaces it.");
    expect(pages[0]!.body).toContain("## Removed rules");
  });

  it("gives every command a page with each flag as its own heading", () => {
    const pages = cliPages();
    for (const command of commandList) {
      const page = pages.find((p) => commandPath(command.name) === `/${p.id}/`)!;
      expect(page.title).toBe(`archidocs ${command.name}`);
      for (const flag of Object.keys(command.flags)) expect(page.body).toMatch(new RegExp(`^### \`--${flag}\`$`, "m"));
    }
  });

  it("gives every command page its examples, each a line the CLI accepts, and its exit codes", () => {
    const pages = cliPages();
    for (const command of commandList) {
      const page = pages.find((p) => commandPath(command.name) === `/${p.id}/`)!;
      for (const heading of ["Examples", "Exit codes", "See also"]) expect(page.body, `${command.name}: ${heading}`).toMatch(new RegExp(`^## ${heading}$`, "m"));
      expect(command.examples.length, command.name).toBeGreaterThan(0);
      for (const example of command.examples) {
        expect(parseCommandLine(archidocsArgs(example.command) ?? []), example.command).toEqual({ ok: true, command: command.name });
        // In a shell fence, so the build's command-line check reads it too.
        expect(page.body).toContain(`\`\`\`sh\n${example.command}\n\`\`\``);
        expect(page.body).toContain(example.description);
      }
      for (const { code } of command.exitCodes) expect(page.body, `${command.name} exit ${code}`).toMatch(new RegExp(`^\\| \`${code}\` \\| `, "m"));
      expect(checkMarkdown(page.body), command.name).toEqual([]);
    }
  });

  it("fails the page of a command whose example the CLI would refuse", () => {
    const [check] = commandList.filter((c) => c.name === "check");
    const wrong: CommandDefinition = { ...check!, examples: [{ command: "archidocs check --strct", description: "Fail on warnings too." }] };
    const page = cliPages([wrong])[1]!;
    expect(checkMarkdown(page.body).map((p) => p.line)).toEqual(["archidocs check --strct"]);
  });

  it("links every command page to the pages that use the command, all of which exist", async () => {
    const generated = await byId();
    for (const command of commandList) {
      const page = cliPages().find((p) => commandPath(command.name) === `/${p.id}/`)!;
      const links = SEE_ALSO[command.name as keyof typeof SEE_ALSO];
      expect(links.length, command.name).toBeGreaterThan(0);
      for (const { href, title } of links) {
        expect(page.body, `${command.name} → ${href}`).toContain(`](${href})`);
        // A hand-written page gives the link its title; a link with a title of its own goes to a generated page.
        if (title === undefined) expect(handWrittenFile(href), href).toBeDefined();
        else expect(generated.has(href.replace(/^\/|\/$/g, "")), href).toBe(true);
      }
    }
  });

  it("explains on the CLI index how the Workspace is found, and where each command starts looking", () => {
    const [index, ...commandPages] = cliPages();
    const section = index!.body.slice(index!.body.indexOf("## How the Workspace is found"), index!.body.indexOf("## Exit codes"));
    expect(WORKSPACE_SECTION).toBe("/docs/reference/cli/#how-the-workspace-is-found");
    expect(section).toContain(`archidocs: ${NO_WORKSPACE}`);
    for (const command of commandList) expect(section, command.name).toMatch(new RegExp(`^\\| \\[\`archidocs ${command.name}\`\\]`, "m"));
    // Each command that takes --workspace or reads a Workspace links the section; `version` and `guide` read none.
    const linking = commandPages.filter((p) => p.body.includes(`](${WORKSPACE_SECTION})`)).map((p) => p.label);
    expect(linking).toEqual(commandList.map((c) => c.name).filter((name) => name !== "version" && name !== "guide"));
  });

  it("documents every MCP tool the server lists under its own heading, split by readOnlyHint", async () => {
    const tools = await listTools();
    const [read, write] = await mcpPages(tools);
    expect(tools.length).toBeGreaterThan(20);
    for (const tool of tools) {
      const page = tool.annotations?.readOnlyHint === false ? write! : read!;
      expect(page.body).toMatch(new RegExp(`^## ${tool.name}$`, "m"));
    }
    expect(write!.body).toMatch(/^## upsert_element$/m);
  });

  it("covers every top-level key of every schema in the Model YAML pages", async () => {
    const bodies = modelPages().map((p) => p.body).join("\n");
    for (const name of ["workspace", "project", "model", "adr"]) {
      const schema = (await import(repoPath(`schemas/${name}.schema.json`), { with: { type: "json" } })).default as { properties: Record<string, unknown> };
      for (const key of Object.keys(schema.properties)) expect(bodies).toContain(`## \`${key}\``);
    }
  });

  it("renders every agent guide topic, with the rules topic pointing at the rule reference", async () => {
    const pages = await byId();
    for (const topic of topics.filter((t) => t.id !== "rules")) expect(pages.has(`docs/reference/agent-guide/${topic.id}`)).toBe(true);
    expect(pages.get("docs/reference/agent-guide")!.body).toContain("[`rules`](/docs/reference/rules/)");
  });

  it("rewrites the repo's relative links for the site", () => {
    expect(rewriteLinks("See [x](topics/saved-view.md#steps), [g](../GLOSSARY.md) and [a](../docs/publishing.md).", "guide/SKILL.md")).toBe(
      "See [x](/docs/reference/agent-guide/saved-view/#steps), [g](/docs/reference/glossary/) and [a](https://github.com/chalharb/archidocs/blob/main/docs/publishing.md).",
    );
    expect(rewriteLinks("as the `rules` topic explains", "guide/SKILL.md")).toBe("as the [`rules` topic](/docs/reference/rules/) explains");
  });

  it("gives each Glossary term an anchor of its own", () => {
    expect(anchorTerms("**Deployment Target**:\nThe place a Service runs.")).toBe('<span id="term-deployment-target"></span>**Deployment Target**:\nThe place a Service runs.');
    expect(termAnchor("Upstream / Downstream")).toBe("term-upstream-downstream");
    const body = glossaryPage().body;
    for (const term of ["Workspace", "Project", "Element", "Relationship", "Team", "Owner", "Saved View", "Lens"]) expect(body).toContain(`id="${termAnchor(term)}"`);
  });

  it("commits no generated page: none has a file in src/content/docs", async () => {
    for (const id of (await byId()).keys()) {
      for (const ext of [".md", ".mdx", "/index.md", "/index.mdx"]) expect(existsSync(repoPath(`website/src/content/docs/${id}${ext}`)), `${id}${ext}`).toBe(false);
    }
  });
});
