import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.ts";
import { commandList, NO_WORKSPACE, parseCommandLine, type CommandDefinition } from "../../src/cli/commands.ts";
import type { Files } from "../../src/core/files.ts";
import { ruleAreas, rules } from "../../src/core/rules.ts";
import { topics } from "../../src/guide/index.ts";
import { archidocsArgs, checkMarkdown } from "../src/lib/command-lines.ts";
import { repoPath } from "../src/lib/repo.ts";
import { cliPages, commandPath, FILES_SECTION, handWrittenFile, SEE_ALSO, WORKSPACE_SECTION } from "../src/reference/cli.ts";
import { generatedPages } from "../src/reference/index.ts";
import { fieldSections, type JsonSchema } from "../src/reference/json-schema.ts";
import { captureTools, EXAMPLES, listTools, mcpPages, toolErrors, toolPath } from "../src/reference/mcp.ts";
import { ERROR_CODES } from "../../src/mcp/index.ts";
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
  let stdout = "";
  let stderr = "";
  const code = await run(["check"], {
    cwd: root,
    env: {},
    stdout: { write: (chunk: string) => (stdout += chunk) },
    stderr: { write: (chunk: string) => (stderr += chunk) },
  });
  if (code !== 0 && code !== 1) throw new Error(`archidocs check exited ${code}: ${stderr}`);
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
    const section = index!.body.slice(index!.body.indexOf("## How the Workspace is found"), index!.body.indexOf("## Which files are read"));
    expect(WORKSPACE_SECTION).toBe("/docs/reference/cli/#how-the-workspace-is-found");
    expect(section).toContain(`archidocs: ${NO_WORKSPACE}`);
    for (const command of commandList) expect(section, command.name).toMatch(new RegExp(`^\\| \\[\`archidocs ${command.name}\`\\]`, "m"));
    // Each command that takes --workspace or reads a Workspace links the section; `version` and `guide` read none.
    const linking = commandPages.filter((p) => p.body.includes(`](${WORKSPACE_SECTION})`)).map((p) => p.label);
    expect(linking).toEqual(commandList.map((c) => c.name).filter((name) => name !== "version" && name !== "guide"));
  });

  it("says on the CLI index which files a command reads, after how the Workspace is found, and links it from dev's page", () => {
    const [index, ...commandPages] = cliPages();
    const body = index!.body;
    expect(body.indexOf("## How the Workspace is found")).toBeLessThan(body.indexOf("## Which files are read"));
    const section = body.slice(body.indexOf("## Which files are read"), body.indexOf("## Exit codes"));
    expect(FILES_SECTION).toBe("/docs/reference/cli/#which-files-are-read");
    for (const text of ["`.yaml`", "`.md`", "`.`", "`node_modules`"]) expect(section).toContain(text);
    for (const name of ["check", "build", "export", "mcp", "dev"]) expect(section).toContain(`[\`archidocs ${name}\`]`);
    const linking = commandPages.filter((p) => p.body.includes(`](${FILES_SECTION})`)).map((p) => p.label);
    expect(linking).toEqual(["dev"]);
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

describe("MCP tool pages", () => {
  const pages = async () => new Map(mcpPages(await captureTools()).map((p) => [p.id, p]));
  /** The Field column of every table in a page, one list per table. */
  const tableFields = (body: string): string[][] =>
    body
      .split(/\n{2,}/)
      .filter((block) => block.startsWith("| Field |"))
      .map((block) => block.split("\n").slice(2).map((line) => line.split(" | ")[0]!.replace(/^\| /, "")));

  it("gives every tool a page with its input, output, an example call with its real result, and its errors", async () => {
    const tools = await listTools();
    const all = await pages();
    expect(tools.length).toBeGreaterThan(20);
    for (const tool of tools) {
      const page = all.get(`docs/reference/mcp/${tool.name}`);
      expect(page, tool.name).toBeDefined();
      expect(page!.title).toBe(tool.name);
      expect(headings(page!.body), tool.name).toEqual(["Input", "Output", "Example", "Errors", "See also"]);
      expect(page!.body, tool.name).toMatch(/^## Example\n\n[^\n]+\n\nArguments:\n\n```json\n[\s\S]+?\n```\n\nResult:\n\n```json\n\{/m);
    }
  });

  it("shows the result each example call really returns", async () => {
    const captured = await captureTools();
    const impact = captured.tools.find((c) => c.tool.name === "get_impact")!;
    expect(impact.example.arguments).toEqual(EXAMPLES["get_impact"]!.arguments);
    expect(impact.example.result).toMatchObject({ id: "sink:orders-db", direction: "upstream" });
    const body = (await pages()).get("docs/reference/mcp/get_impact")!.body;
    expect(body).toContain('"id": "sink:orders-db"');
    // No path from the machine that built the site.
    expect(JSON.stringify(captured)).not.toContain(repoPath(""));
  });

  it("fails when a tool has no example input, or its example returns an error", async () => {
    const withoutOne = Object.fromEntries(Object.entries(EXAMPLES).filter(([name]) => name !== "get_element"));
    await expect(captureTools(withoutOne)).rejects.toThrow(/get_element has no example/);
    await expect(captureTools({ ...EXAMPLES, get_element: { arguments: { id: "sink:nope" } } })).rejects.toThrow(/get_element's example returned not_found/);
  });

  it("calls every tool that takes dry_run with dry_run: true, and writes nothing", async () => {
    const captured = await captureTools();
    const dry = captured.tools.filter((c) => c.tool.inputSchema.properties?.["dry_run"]);
    expect(dry.map((c) => c.tool.name)).toContain("upsert_element");
    for (const c of dry) expect(c.example.arguments["dry_run"], c.tool.name).toBe(true);
    await expect(captureTools({ ...EXAMPLES, upsert_team: { arguments: { id: "billing", fields: { name: "Billing" } } } })).rejects.toThrow(/upsert_team's example must pass dry_run: true/);
    const { stdout } = await promisify(execFile)("git", ["status", "--porcelain", "--", "examples/kitchen-sink"], { cwd: repoPath("") });
    expect(stdout).toBe("");
  });

  it("repeats no field name in any table, and shows a union output as one table per variant", async () => {
    for (const page of (await pages()).values()) for (const fields of tableFields(page.body)) expect(new Set(fields).size, `${page.id}: ${fields.join(", ")}`).toBe(fields.length);
    const element = (await pages()).get("docs/reference/mcp/get_element")!.body;
    for (const kind of ["person", "system", "service", "component"]) expect(element).toContain(`When \`element.kind\` is \`${kind}\``);
    expect((await pages()).get("docs/reference/mcp/get_view")!.body).toContain("When `lens` has `team`");
  });

  it("splits a union of objects into shared rows and a section per variant", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        thing: {
          oneOf: [
            { type: "object", properties: { kind: { const: "a" }, id: { type: "string" }, size: { type: "number" } }, required: ["kind", "id"] },
            { type: "object", properties: { kind: { const: "b" }, id: { type: "string" }, url: { type: "string" } }, required: ["kind", "id"] },
          ],
        },
      },
    };
    const sections = fieldSections(schema);
    expect(sections.map((s) => [s.when, s.rows.map((r) => r.path)])).toEqual([
      [undefined, ["thing", "thing.kind", "thing.id"]],
      ["When `thing.kind` is `a`", ["thing.size"]],
      ["When `thing.kind` is `b`", ["thing.url"]],
    ]);
    expect(sections[0]!.rows[1]!.type).toBe('`"a"` or `"b"`');
  });

  it("keeps read-tools and write-tools as indexes, with a heading per tool so old anchors resolve", async () => {
    const tools = await listTools();
    const all = await pages();
    const read = all.get("docs/reference/mcp/read-tools")!.body;
    const write = all.get("docs/reference/mcp/write-tools")!.body;
    for (const tool of tools) {
      const index = tool.annotations?.readOnlyHint === false ? write : read;
      expect(index, tool.name).toMatch(new RegExp(`^## ${tool.name}$`, "m"));
      expect(index, tool.name).toMatch(new RegExp(`^\\| \\[\`${tool.name}\`\\]\\(${toolPath(tool)}\\) \\|`, "m"));
    }
  });

  it("lists on each tool's page the error codes it can return", async () => {
    const byName = new Map((await listTools()).map((t) => [t.name, t]));
    const codes = (name: string) => toolErrors(byName.get(name)!).map((e) => e.code);
    expect(codes("get_element")).toEqual(["invalid_input", "not_found", "source_unavailable", "history_unavailable"]);
    expect(codes("get_changes")).toEqual(["invalid_input", "not_found", "ambiguous", "source_unavailable", "history_unavailable"]);
    expect(codes("upsert_relationship")).toEqual(["invalid_input", "not_found", "ambiguous", "validation_failed", "read_only", "source_unavailable"]);
    expect(codes("check")).toEqual(["invalid_input", "read_only", "source_unavailable"]);
    expect(codes("get_authoring_guide")).toEqual(["invalid_input", "not_found"]);
    expect((await pages()).get("docs/reference/mcp/get_element")!.body).toContain("- [`not_found`](/docs/reference/mcp/errors/#not_found) when");
  });

  it("lists every error code the server can return on the errors page", async () => {
    const body = (await pages()).get("docs/reference/mcp/errors")!.body;
    for (const code of Object.keys(ERROR_CODES)) expect(body).toMatch(new RegExp(`^## \`${code}\`$`, "m"));
    // Every code a tool result is built with, in the server and the writer it calls, is in the list.
    const { stdout } = await promisify(execFile)("git", ["grep", "-hoE", `(code: |fail\\()"[a-z_]+"`, "--", "src/mcp", "src/writer"], { cwd: repoPath("") });
    const used = new Set(stdout.split("\n").filter(Boolean).map((m) => /"([a-z_]+)"/.exec(m)![1]!));
    expect(used.size).toBeGreaterThan(4);
    for (const code of used) expect(Object.keys(ERROR_CODES), code).toContain(code);
  });
});
