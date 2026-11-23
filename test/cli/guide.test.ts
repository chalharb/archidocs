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
    for (const topic of topics) {
      const printed = await archidocs(tmpdir(), "guide", topic);
      expect(printed.stdout, topic).toBe(text(await call("get_authoring_guide", { topic })));
    }
  });

  it("exits 2 on an unknown topic, naming the closest one", async () => {
    const { code, stderr } = await archidocs(tmpdir(), "guide", "bootstrp");
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown topic "bootstrp"; did you mean "bootstrap"?');
  });
});
