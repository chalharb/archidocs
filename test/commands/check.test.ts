import { describe, expect, it } from "vitest";
import { check } from "../../src/commands/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { brokenWorkspace, checkoutOf } from "./support.ts";

describe("check", () => {
  it("returns the issues of a broken Workspace", async () => {
    const { checkout } = await checkoutOf(brokenWorkspace);

    const result = await check(checkout);

    expect(result.kind).toBe("checked");
    expect(result.issues.map((i) => [i.file, i.rule, i.severity])).toEqual([
      ["archidocs/shop/more.yaml", "unknown-team", "error"],
      ["archidocs/shop/services.yaml", "unknown-field", "error"],
    ]);
  });

  it("returns no issues for a valid Workspace", async () => {
    const { checkout } = await checkoutOf(validWorkspace);

    expect(await check(checkout)).toEqual({ kind: "checked", issues: [] });
  });
});
