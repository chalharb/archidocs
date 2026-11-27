import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { validWorkspace } from "../support/fixtures.ts";
import { archidocs } from "../support/cli.ts";
import { connect } from "../support/mcp.ts";

describe("archidocs guide", () => {
  it("prints the same text as get_authoring_guide, for SKILL.md and for every topic", async () => {
    const { call, text } = await connect(validWorkspace);
    const index = await call("get_authoring_guide");
    const topics = (index.structuredContent as { topics: { id: string }[] }).topics.map((t) => t.id);

    const cli = await archidocs(tmpdir(), "guide");
    expect(cli.code).toBe(0);
    expect(cli.stdout).toBe(text(index));
    // One CLI process per topic: run them together, so the test does not grow with the topic count.
    const printed = await Promise.all(topics.map((topic) => archidocs(tmpdir(), "guide", topic)));
    for (const [i, topic] of topics.entries()) {
      expect(printed[i]!.stdout, topic).toBe(text(await call("get_authoring_guide", { topic })));
    }
  }, 30_000);

  it("exits 2 on an unknown topic, naming the closest one", async () => {
    const { code, stderr } = await archidocs(tmpdir(), "guide", "bootstrp");
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown topic "bootstrp"; did you mean "bootstrap"?');
  });
});

describe("archidocs guide --skill", () => {
  it("prints what get_guide serves, and defaults to authoring", async () => {
    const { call, text } = await connect(validWorkspace);
    const [plain, skill, topic, topicFirst] = await Promise.all([
      archidocs(tmpdir(), "guide"),
      archidocs(tmpdir(), "guide", "--skill", "authoring"),
      archidocs(tmpdir(), "guide", "--skill", "authoring", "relationships"),
      archidocs(tmpdir(), "guide", "relationships", "--skill", "authoring"),
    ]);
    expect(skill.code).toBe(0);
    expect(skill.stdout).toBe(text(await call("get_guide", { skill: "authoring" })));
    expect(plain.stdout).toBe(skill.stdout);
    expect(topic.stdout).toBe(text(await call("get_guide", { skill: "authoring", topic: "relationships" })));
    expect(topicFirst.stdout).toBe(topic.stdout);
  }, 30_000);

  it("prints the fill-gaps skill, and the moved-topic note for the old authoring topic", async () => {
    const { call, text } = await connect(validWorkspace);
    const [skill, moved] = await Promise.all([archidocs(tmpdir(), "guide", "--skill", "fill-gaps"), archidocs(tmpdir(), "guide", "fill-gaps")]);
    expect(skill.code).toBe(0);
    expect(skill.stdout).toBe(text(await call("get_guide", { skill: "fill-gaps" })));
    expect(moved.code).toBe(0);
    expect(moved.stdout).toBe(text(await call("get_authoring_guide", { topic: "fill-gaps" })));
    expect(moved.stdout).toContain("archidocs-fill-gaps");
  }, 30_000);

  it("prints the describe guide as get_guide serves it", async () => {
    const { call, text } = await connect(validWorkspace);
    const cli = await archidocs(tmpdir(), "guide", "--skill", "describe");
    expect(cli.code).toBe(0);
    expect(cli.stdout).toBe(text(await call("get_guide", { skill: "describe" })));
  });

  it("exits 2 on an unknown skill, naming the closest one", async () => {
    const { code, stderr } = await archidocs(tmpdir(), "guide", "--skill", "authorng");
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown skill "authorng"; did you mean "authoring"?');
  });
});
