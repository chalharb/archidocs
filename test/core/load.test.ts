import { describe, expect, it } from "vitest";
import { load, nodeFileSystem, serializeBundle } from "../../src/core/index.ts";
import { loadWorkspace, writeWorkspace } from "../support/workspace.ts";
import { validWorkspace } from "../support/fixtures.ts";

describe("Load of a valid Workspace", () => {
  it("builds a Bundle with qualified ids and source locations, and no issues", async () => {
    const { bundle, issues } = await loadWorkspace(validWorkspace);

    expect(issues).toEqual([]);
    expect(bundle.projects).toEqual([
      { id: "payments", name: "Payments", owner: "payments-team", folder: "archidocs/payments", source: { file: "archidocs/payments/project.yaml", line: 1 } },
      { id: "shop", name: "Shop", owner: "storefront-team", folder: "archidocs/shop", source: { file: "archidocs/shop/project.yaml", line: 1 } },
    ]);
    expect(bundle.elements.map((e) => [e.id, e.kind, e.owner, e.source])).toEqual([
      ["payments:payments-api", "service", "payments-team", { file: "archidocs/payments/model/api.yaml", line: 3 }],
      ["payments:stripe", "service", "storefront-team", { file: "archidocs/payments/model/api.yaml", line: 10 }],
      ["shop:orders-db", "service", "storefront-team", { file: "archidocs/shop/services.yaml", line: 6 }],
      ["shop:web", "service", "storefront-team", { file: "archidocs/shop/services.yaml", line: 2 }],
    ]);
  });
});

describe("Bundle stability", () => {
  it("is byte-identical when the same Workspace is built twice", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const header = { commit: "0123abc", builtAt: "2026-11-22T10:00:00Z" };
    const first = await load({ fs: nodeFileSystem(), root, repoRoot, ...header });
    const second = await load({ fs: nodeFileSystem(), root, repoRoot, ...header });

    expect(serializeBundle(second.bundle)).toBe(serializeBundle(first.bundle));
  });

  it("writes keys in the contract's fixed order", async () => {
    const { bundle } = await loadWorkspace(validWorkspace);
    const json = JSON.parse(serializeBundle(bundle));

    expect(Object.keys(json)).toEqual([
      "schemaVersion", "commit", "builtAt", "teams", "environments", "projects", "elements", "relationships", "targets", "deployments", "views", "adrs",
    ]);
    expect(Object.keys(json.elements[0])).toEqual([
      "id", "kind", "parent", "name", "description", "owner", "tags", "links", "type", "technology", "external", "source",
    ]);
  });
});

describe("Load of a Workspace with problems", () => {
  it("reports a YAML syntax error as an issue and still checks the other files", async () => {
    const { bundle, issues } = await loadWorkspace({
      ...validWorkspace,
      "shop/broken.yaml": "services:\n  cart: {name: Cart\n",
      "payments/more.yaml": "services:\n  refunds:\n    name: Refunds\n    owner: payment-team\n    type: queue\n",
    });

    expect(issues).toEqual([
      expect.objectContaining({ file: "archidocs/payments/more.yaml", line: 4, column: 12, rule: "unknown-team", message: 'Unknown Team "payment-team"; did you mean "payments-team"?' }),
      expect.objectContaining({ file: "archidocs/payments/more.yaml", line: 5, column: 11, rule: "invalid-value", message: 'Invalid value for "type": expected one of "app"|"datastore"|"broker"' }),
      expect.objectContaining({ file: "archidocs/shop/broken.yaml", rule: "yaml-syntax", severity: "error" }),
    ]);
    expect(bundle.elements.map((e) => e.id)).toContain("shop:web");
  });

  it("still registers the id of an Element that fails the schema, so only the root cause is reported", async () => {
    const { issues } = await loadWorkspace({
      ...validWorkspace,
      "shop/more.yaml": "services:\n  web:\n    nme: Web again\n",
    });

    expect(issues.map((i) => [i.file, i.line, i.rule])).toEqual([
      ["archidocs/shop/more.yaml", 2, "missing-field"],
      ["archidocs/shop/more.yaml", 3, "unknown-field"],
      ["archidocs/shop/services.yaml", 2, "duplicate-id"],
    ]);
  });

  it("reports an issue involving two places once, at the later path, naming the other", async () => {
    const { issues } = await loadWorkspace({
      ...validWorkspace,
      "shop/z-more.yaml": "services:\n  web:\n    name: Web again\n",
    });

    expect(issues).toEqual([
      { file: "archidocs/shop/z-more.yaml", line: 2, column: 3, rule: "duplicate-id", severity: "error", message: 'Id "web" is already declared in Project "shop" at archidocs/shop/services.yaml:2' },
    ]);
  });
});
