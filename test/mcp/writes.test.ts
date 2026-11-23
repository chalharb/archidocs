import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundleSource } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { connect, connectTo } from "../support/mcp.ts";

describe("write tools", () => {
  it("run against a checkout: check validates what is on disk", async () => {
    const { call, text, root } = await connect(validWorkspace);
    expect((await call("check")).structuredContent).toEqual({ issues: [], summary: { errors: 0, warnings: 0 } });

    await writeFile(join(root, "shop/broken.yaml"), "services:\n  cart:\n    name: Cart\n    owner: nobody\n");
    const result = await call("check");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      issues: [{ file: "archidocs/shop/broken.yaml", line: 4, rule: "unknown-team", severity: "error" }],
      summary: { errors: 1, warnings: 0 },
    });
    expect(text(result)).toContain("1 error, 0 warnings");
  });

  it("return read_only from a Bundle source", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, "a".repeat(40)));
    const { call } = await connectTo(bundleSource({ location: site.url }));
    const result = await call("check");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "read_only", message: expect.stringContaining("published Bundle") });
  });

  it("return read_only when the transport doesn't allow writes, as over HTTP without --allow-writes", async () => {
    const { call } = await connect(validWorkspace, { allowWrites: false });
    expect((await call("get_workspace_info")).structuredContent).toMatchObject({ writesAllowed: false });
    const result = await call("check");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ code: "read_only", message: expect.stringContaining("--allow-writes") });
  });

  it("are advertised as not read-only", async () => {
    const { client } = await connect(validWorkspace);
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "check")?.annotations).toMatchObject({ readOnlyHint: false });
    expect(tools.find((t) => t.name === "get_element")?.annotations).toMatchObject({ readOnlyHint: true });
  });
});
