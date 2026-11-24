import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandList } from "../../src/cli/commands.ts";
import { rules } from "../../src/core/rules.ts";
import { topics } from "../../src/guide/index.ts";
import { repoPath } from "../src/lib/repo.ts";
import { cliPages, commandPath } from "../src/reference/cli.ts";
import { generatedPages } from "../src/reference/index.ts";
import { listTools, mcpPages } from "../src/reference/mcp.ts";
import { modelPages } from "../src/reference/model.ts";
import { rulePages } from "../src/reference/rules.ts";
import { anchorTerms, glossaryPage, rewriteLinks, termAnchor } from "../src/reference/text-sources.ts";

const byId = async () => new Map((await generatedPages()).map((p) => [p.id, p]));

describe("generated reference pages", () => {
  it("gives every rule in the registry a page titled with its id, and lists it on the index", async () => {
    const pages = await byId();
    const index = pages.get("docs/reference/rules")!;
    for (const rule of rules) {
      expect(pages.get(`docs/reference/rules/${rule.id}`)?.title).toBe(rule.id);
      expect(index.body).toContain(`(/docs/reference/rules/${rule.id}/)`);
    }
  });

  it("keeps a stub page for each removed rule, linking its replacement", () => {
    const [current] = rules;
    const pages = rulePages(rules, [
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
