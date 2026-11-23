import { describe, expect, it } from "vitest";
import { ruleCatalogue } from "../../src/core/index.ts";
import { skillStub } from "../../src/guide/index.ts";
import { bundleSource } from "../../src/mcp/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { connect, connectTo } from "../support/mcp.ts";

const topics = ["bootstrap", "add-service", "relationships", "deployments", "dynamic-view", "saved-view", "propose-adr", "change", "rules"];

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
    expect(frontmatter(skillStub)).toBe(frontmatter(text));
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
