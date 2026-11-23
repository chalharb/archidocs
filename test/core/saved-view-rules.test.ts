import { describe, expect, it } from "vitest";
import { loadWorkspace, type Files } from "../support/workspace.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";

/** The landscape fixture plus `views: structural:` in the shop Project, given as YAML under it. */
const withViews = (views: string, extra: Files = {}): Files => ({
  ...landscapeWorkspace,
  "shop/views.yaml": `views:\n  structural:\n${views.replace(/^/gm, "    ")}\n`,
  ...extra,
});

const issuesOf = async (views: string, extra: Files = {}) => (await loadWorkspace(withViews(views, extra))).issues.map(({ line, rule, severity, message }) => ({ line, rule, severity, message }));

describe("Saved View schema", () => {
  it("checks each selector against the form it is written in", async () => {
    expect(await issuesOf(`v:\n  title: V\n  level: c2\n  include:\n    - { element: web, upstream: some }\n    - { team: payments-team, owner: x }\n    - 42`)).toEqual([
      { line: 7, rule: "invalid-value", severity: "error", message: 'Invalid value for "upstream": must be a number of hops, or `all`' },
      { line: 8, rule: "unknown-field", severity: "error", message: 'Unknown field "owner"' },
      { line: 9, rule: "invalid-value", severity: "error", message: 'Invalid value for "include.2": a selector is an id, or a map with `element`, `team`, `tag` or `from` and `to`' },
    ]);
  });

  it("needs an environment for a Deployment View, and takes environment and targets only there", async () => {
    expect(await issuesOf(`v:\n  title: V\n  level: deployment\nw:\n  title: W\n  level: c2\n  environment: prod`)).toEqual([
      { line: 3, rule: "missing-field", severity: "error", message: 'Missing required field "environment": a Deployment View names its Environment' },
      { line: 9, rule: "invalid-value", severity: "error", message: 'Invalid value for "environment": only a `level: deployment` View takes `environment`' },
    ]);
  });
});

describe("references in Saved Views", () => {
  it("reports unknown Elements in selectors, expand, collapse and the Lens", async () => {
    const issues = await issuesOf(`v:
  title: V
  level: c2
  include: [wbe, { element: payments:payment-api }, { from: web, to: crat }]
  exclude: [{ element: crt-db }]
  expand: [chekout]
  collapse: [payments:paymnts]
  lens: { impact: crt }`);

    expect(issues.filter((i) => i.rule === "unknown-element").map((i) => i.message)).toEqual([
      'Unknown Element "wbe" in Project "shop"; did you mean "web"?',
      'Unknown Element "payment-api" in Project "payments"; did you mean "payments:payments-api"?',
      'Unknown Element "crat" in Project "shop"; did you mean "cart"?',
      'Unknown Element "crt-db" in Project "shop"; did you mean "cart-db"?',
      'Unknown Element "chekout" in Project "shop"; did you mean "checkout"?',
      'Unknown Element "paymnts" in Project "payments"; did you mean "payments:payments"?',
      'Unknown Element "crt" in Project "shop"; did you mean "cart"?',
    ]);
  });

  it("reports unknown Projects, own-Project prefixes, unknown Teams, Environments and Targets", async () => {
    const issues = await issuesOf(`v:
  title: V
  level: c2
  include: [paymnts:payments-api, shop:web, { team: payment-team }]
d:
  title: D
  level: deployment
  environment: prd
  targets: [platform:eks-prd]`);

    expect(issues.map((i) => [i.rule, i.message])).toEqual([
      ["own-project-prefix", 'Write "web", not "shop:web", inside Project "shop"'],
      ["unknown-project", 'Unknown Project "paymnts" in "paymnts:payments-api"; did you mean "payments:payments-api"?'],
      ["unknown-team", 'Unknown Team "payment-team"; did you mean "payments-team"?'],
      ["unknown-environment", 'Unknown Environment "prd"; did you mean "prod"?'],
      ["unknown-target", 'Unknown Deployment Target "eks-prd" in Project "platform"; did you mean "eks-prod"?'],
    ]);
  });
});

describe("View rules", () => {
  it("duplicate-view-id: a View id repeats in a Project, across files too", async () => {
    const { issues } = await loadWorkspace(withViews(`v:\n  title: V\n  level: c1`, { "shop/more.yaml": "views:\n  structural:\n    v:\n      title: Again\n      level: c1\n" }));

    expect(issues).toEqual([
      { file: "archidocs/shop/views.yaml", line: 3, column: 5, rule: "duplicate-view-id", severity: "error", message: 'View id "v" is already used in Project "shop" at archidocs/shop/more.yaml:3' },
    ]);
  });

  it("target-outside-environment: a targets entry has no Deployment in the View's Environment", async () => {
    const extra = { "platform/more.yaml": "targets:\n  eks-staging:\n    name: EKS staging\n    kind: cluster\n" };
    const issues = await issuesOf(`d:\n  title: D\n  level: deployment\n  environment: prod\n  targets: [platform:aws-eu, platform:eks-prod, platform:eks-staging]`, extra);

    expect(issues).toEqual([
      { line: 7, rule: "target-outside-environment", severity: "error", message: 'Deployment Target "platform:eks-staging" has no Deployment in Environment "prod"' },
    ]);
  });

  it("bad-expand: an expand or collapse id is not in the View, or has no children", async () => {
    const issues = await issuesOf(`v:\n  title: V\n  level: c1\n  include: [web, checkout]\n  expand: [web, checkout, payments:payments]\n  collapse: [checkout]`);

    expect(issues).toEqual([
      { line: 7, rule: "bad-expand", severity: "error", message: 'Can\'t expand "shop:web": it has no children' },
      { line: 7, rule: "bad-expand", severity: "error", message: 'Can\'t expand "payments:payments": it is not in the View' },
    ]);
  });

  it("empty-view: a Saved View resolves to no nodes", async () => {
    const issues = await issuesOf(`v:\n  title: V\n  level: c1\n  include: [{ tag: nothing-has-this }]`);

    expect(issues).toEqual([{ line: 3, rule: "empty-view", severity: "warning", message: 'Saved View "shop:v" resolves to no nodes' }]);
  });

  it("unresolved-path: a path selector or path Lens finds no path", async () => {
    const issues = await issuesOf(`v:\n  title: V\n  level: c2\n  include: [web, { from: events, to: shopper }]\n  lens: { path: { from: events, to: web } }`);

    expect(issues).toEqual([
      { line: 6, rule: "unresolved-path", severity: "warning", message: 'No path between "shop:events" and "shop:shopper"' },
      { line: 7, rule: "unresolved-path", severity: "warning", message: 'No path between "shop:events" and "shop:web"' },
    ]);
  });

  it("oversized-view: a Saved View over 150 nodes", async () => {
    const many = Array.from({ length: 151 }, (_, i) => `  s${i}: { name: S${i}, tags: [big] }\n`).join("");
    const issues = await issuesOf(`v:\n  title: V\n  level: c2\n  include: [{ tag: big }]`, { "shop/many.yaml": `services:\n${many}` });

    expect(issues).toContainEqual({ line: 3, rule: "oversized-view", severity: "warning", message: 'Saved View "shop:v" has 151 nodes, more than the 150 a diagram stays readable at' });
  });
});
