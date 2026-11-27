import { glob, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ruleCatalogue } from "../../src/core/index.ts";
import { skillGuide, skills, skillStub } from "../../src/guide/index.ts";
import { bundleSource } from "../../src/mcp/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { connect, connectTo } from "../support/mcp.ts";

const topics = ["bootstrap", "add-service", "relationships", "deployments", "dynamic-view", "saved-view", "propose-adr", "fill-gaps", "change", "rules"];

describe("get_authoring_guide", () => {
  it("returns SKILL.md and lists every topic", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("get_authoring_guide");
    expect(result.isError).toBeFalsy();
    const data = result.structuredContent as { topic: string | null; topics: { id: string; summary: string }[]; text: string };
    expect(data.topic).toBeNull();
    expect(data.topics.map((t) => t.id)).toEqual(topics);
    expect(data.text).toMatch(/^---\nname: archidocs-authoring\n/);
    for (const id of topics) expect(data.text).toContain(`\`${id}\``);
    expect(text(result)).toBe(data.text);
  });

  it("shares its frontmatter with the stub init installs, so the stub's trigger matches the skill", async () => {
    const { call } = await connect(validWorkspace);
    const { text } = (await call("get_authoring_guide")).structuredContent as { text: string };
    const frontmatter = (s: string) => /^---\n[\s\S]*?\n---\n/.exec(s)![0];
    expect(frontmatter(skillStub("authoring", "archidocs"))).toBe(frontmatter(text));
  });

  it("returns one topic's reference file", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("get_authoring_guide", { topic: "dynamic-view" });
    expect(result.structuredContent).toMatchObject({ topic: "dynamic-view" });
    expect(text(result)).toMatch(/^# Dynamic View/);
    expect(text(result)).toContain("upsert_view");
  });

  it("serves the rule catalogue generated from the rule registry as the `rules` topic", async () => {
    const { call, text } = await connect(validWorkspace);
    expect(text(await call("get_authoring_guide", { topic: "rules" }))).toBe(ruleCatalogue());
  });

  it("names the closest topic when the one asked for doesn't exist", async () => {
    const { call } = await connect(validWorkspace);
    const result = await call("get_authoring_guide", { topic: "add-servce" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "not_found", suggestions: ["add-service"] });
  });

  it("answers even when the Workspace source can't be read", async () => {
    const { call } = await connectTo(bundleSource({ location: "/nowhere/workspace.bundle.json" }));
    const result = await call("get_authoring_guide");
    expect(result.isError).toBeFalsy();
  });
});

describe("get_guide", () => {
  it("serves authoring exactly as get_authoring_guide does, with no topic and with each topic", async () => {
    const { call } = await connect(validWorkspace);
    const index = await call("get_guide", { skill: "authoring" });
    expect(index.isError).toBeFalsy();
    const old = await call("get_authoring_guide");
    expect(index.content).toEqual(old.content);
    expect(index.structuredContent).toEqual({ skill: "authoring", ...old.structuredContent });
    for (const topic of topics) {
      const [now, then] = await Promise.all([call("get_guide", { skill: "authoring", topic }), call("get_authoring_guide", { topic })]);
      expect(now.isError, topic).toBeFalsy();
      expect(now.content, topic).toEqual(then.content);
    }
  });

  it("names the closest skill when the one asked for doesn't exist", async () => {
    const { call } = await connect(validWorkspace);
    const result = await call("get_guide", { skill: "authorng" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "not_found", suggestions: ["authoring"] });
    expect(result.content[0]!.text).toContain('Unknown skill "authorng"');
  });

  it("names the closest topic of the skill when the topic doesn't exist", async () => {
    const { call } = await connect(validWorkspace);
    const result = await call("get_guide", { skill: "authoring", topic: "relationshps" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "not_found", suggestions: ["relationships"] });
  });

  it("serves consult's SKILL.md, with no topics", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("get_guide", { skill: "consult" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ skill: "consult", topic: null });
    expect(text(result)).toMatch(/^---\nname: archidocs-consult\n/);
    expect(text(result)).toContain("## Before the change");
    expect(text(result)).not.toContain("## Topics");
    const frontmatter = (s: string) => /^---\n[\s\S]*?\n---\n/.exec(s)![0];
    expect(frontmatter(skillStub("consult", "archidocs"))).toBe(frontmatter(text(result)));
  });

  it("describes get_authoring_guide as deprecated in favour of get_guide", async () => {
    const { client } = await connect(validWorkspace);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "get_authoring_guide")!.description).toMatch(/deprecated.*get_guide/i);
  });
});

describe("get_guide(\"describe\")", () => {
  it("serves the describe guide, which loads authoring first and has no topics", async () => {
    const { call, text } = await connect(validWorkspace);
    const result = await call("get_guide", { skill: "describe" });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ skill: "describe", topic: null, topics: [] });
    expect(text(result)).toMatch(/^---\nname: archidocs-describe\n/);
    expect(text(result)).toContain('`get_guide("authoring")`');
    expect(skillStub("describe", "archidocs")).toContain('`get_guide("describe")`');
    const frontmatter = (s: string) => /^---\n[\s\S]*?\n---\n/.exec(s)![0];
    expect(frontmatter(skillStub("describe", "archidocs"))).toBe(frontmatter(text(result)));
  });
});

describe("the skill registry", () => {
  it("names each skill archidocs-<id>", () => {
    for (const s of skills) expect(s.name).toBe(`archidocs-${s.id}`);
  });

  it("refuses a topic on a skill with no topics, naming the skill", async () => {
    const result = await skillGuide({ id: "plain", name: "archidocs-plain", description: "A skill without topics.", dir: "" }, "anything");
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toContain('"plain" has no topics');
  });
});

describe("skillStub", () => {
  it("tells the agent to load the skill with get_guide or the CLI, naming the runner", () => {
    const stub = skillStub("authoring", "npx archidocs");
    expect(stub).toMatch(/^---\nname: archidocs-authoring\ndescription: .+\n---\n/);
    expect(stub).toContain('`get_guide("authoring")`');
    expect(stub).toContain("`npx archidocs guide --skill authoring`");
    expect(stub).toContain("In this repo, run every `archidocs` command as `npx archidocs`.");
    expect(skillStub("authoring", "archidocs")).not.toContain("In this repo");
  });

  it("keeps get_authoring_guide in authoring's stub, for servers older than get_guide", () => {
    expect(skillStub("authoring", "archidocs")).toContain("`get_authoring_guide`");
  });

  it("takes its name and description from the registry", () => {
    for (const s of skills) {
      expect(skillStub(s.id, "archidocs")).toMatch(new RegExp(`^---\\nname: ${s.name}\\ndescription: ${s.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n---\\n`));
    }
  });
});

describe("the guides", () => {
  it("name only tools the MCP server registers", async () => {
    const { client } = await connect(validWorkspace);
    const registered = new Set((await client.listTools()).tools.map((t) => t.name));
    // A backticked snake_case name starting with a tool verb, bare or called: `get_element` or `upsert_view(`.
    const toolLike = /`((?:get|list|search|find|upsert|remove|create|propose|delete|update|set|rename|move)_[a-z_]+)[`(]/g;
    const named = new Map<string, string>();
    for await (const file of glob("guide/**/*.md")) {
      for (const [, name] of (await readFile(file, "utf8")).matchAll(toolLike)) named.set(name!, file);
    }
    expect(named.size).toBeGreaterThan(10);
    const unknown = [...named].filter(([name]) => !registered.has(name)).map(([name, file]) => `${name} (${file})`);
    expect(unknown).toEqual([]);
  });
});
