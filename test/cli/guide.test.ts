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
