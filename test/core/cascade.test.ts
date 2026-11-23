import { describe, expect, it } from "vitest";
import { validWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const rulesOf = async (files: Record<string, string>) => (await loadWorkspace(files)).issues.map((i) => `${i.file}:${i.line} ${i.rule}`);

describe("cascade suppression", () => {
  it("a schema-invalid Element still registers its id, so a later duplicate is caught", async () => {
    expect(
      await rulesOf({
        ...validWorkspace,
        "shop/services.yaml": "services:\n  web:\n    techology: Next.js\n",
        "shop/zz.yaml": "services:\n  web:\n    name: Web again\n",
      }),
    ).toEqual(["archidocs/shop/services.yaml:2 missing-field", "archidocs/shop/services.yaml:3 unknown-field", "archidocs/shop/zz.yaml:2 duplicate-id"]);
  });

  it("an Element that isn't a mapping is reported once and still registers its id", async () => {
    expect(
      await rulesOf({
        ...validWorkspace,
        "shop/services.yaml": "services:\n  web: Web\n",
        "shop/zz.yaml": "services:\n  web:\n    name: Web again\n",
      }),
    ).toEqual(["archidocs/shop/services.yaml:2 invalid-value", "archidocs/shop/zz.yaml:2 duplicate-id"]);
  });

  it("a malformed owner is reported as the invalid value only, not also as an unknown Team", async () => {
    expect(
      await rulesOf({
        ...validWorkspace,
        "shop/project.yaml": "id: shop\nname: Shop\nowner: Storefront Team\n",
        "shop/services.yaml": "services:\n  web:\n    name: Web\n    owner: Payments Team\n",
      }),
    ).toEqual(["archidocs/shop/project.yaml:3 invalid-value", "archidocs/shop/services.yaml:4 invalid-value"]);
  });
});
