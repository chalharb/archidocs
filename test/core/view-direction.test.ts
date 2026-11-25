import { describe, expect, it } from "vitest";
import { structuralView } from "../support/views.ts";
import { deploymentViewWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

/** The deployment fixture with Saved Views at every level, some with their own direction. */
const load = async () => {
  const { bundle, issues } = await loadWorkspace({
    ...deploymentViewWorkspace,
    "shop/views.yaml": `views:
  structural:
    landscape:
      title: Landscape
      level: c1
    services:
      title: Services
      level: c2
    components:
      title: Components
      level: c3
    prod:
      title: Prod
      level: deployment
      environment: prod
    prod-sideways:
      title: Prod sideways
      level: deployment
      environment: prod
      direction: RL
    upwards:
      title: Upwards
      level: c2
      direction: BT
`,
  });
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  return bundle;
};

describe("a Structural View's direction", () => {
  it.each([
    ["deployment/prod", "TB"],
    ["shop:prod", "TB"],
    ["c1", "LR"],
    ["c2", "LR"],
    ["c2/shop:checkout", "LR"],
    ["c3/shop:cart", "LR"],
    ["shop:landscape", "LR"],
    ["shop:services", "LR"],
    ["shop:components", "LR"],
  ])("defaults for %s to %s", async (id, direction) => {
    expect(structuralView(await load(), id)?.direction).toBe(direction);
  });

  it.each([
    ["shop:prod-sideways", "RL"],
    ["shop:upwards", "BT"],
  ])("is a Saved View's own when it sets one: %s draws %s", async (id, direction) => {
    expect(structuralView(await load(), id)?.direction).toBe(direction);
  });
});
