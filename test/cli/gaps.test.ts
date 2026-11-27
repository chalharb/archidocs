import { describe, expect, it } from "vitest";
import { listGaps } from "../../src/core/index.ts";
import { landscapeWorkspace, validWorkspace } from "../support/fixtures.ts";
import { archidocs } from "../support/cli.ts";
import { loadWorkspace, writeWorkspace } from "../support/workspace.ts";

/**
 * What the jq script in the fill-gaps guide printed for the landscape
 * Workspace's Bundle (`jq -r -f gaps.jq workspace.bundle.json`), pinned.
 */
const JQ_OUTPUT = `## payments
### payments-team
- component payments:charges: description, technology
- system payments:payments: description
- service payments:payments-api: description, technology, repository, api-docs
- deployment payments:payments-api in prod on platform:eks-prod: url
## shop
### payments-team
- service shop:fraud-check: description, technology, repository, deployments
- relationship shop:fraud-check -> payments:payments-api: technology
### storefront-team
- service shop:cart: description, technology, repository, api-docs
- service shop:cart-db: description, technology, deployments
- system shop:checkout: description
- component shop:checkout-ui: description, technology
- service shop:events: description, deployments
- service shop:order-history: description, technology, repository, deployments
- person shop:shopper: description
- service shop:web: description, technology, repository, deployments
- relationship shop:cart -> shop:cart-db: technology
- relationship shop:checkout-ui -> payments:charges: technology
- relationship shop:checkout-ui -> payments:charges: technology
- relationship shop:order-history -> payments:charges: technology
- relationship shop:web -> shop:cart: technology
- deployment shop:cart in prod on platform:eks-prod: url
`;

describe("archidocs gaps", () => {
  it("prints the same Markdown as the guide's jq script, and exits 0", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);

    expect(await archidocs(repoRoot, "gaps")).toEqual({ code: 0, stdout: JQ_OUTPUT, stderr: "" });
  });

  it("prints the list_gaps shape with --json", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);
    const { bundle } = await loadWorkspace(landscapeWorkspace);

    const { code, stdout } = await archidocs(repoRoot, "gaps", "--json");

    const expected = listGaps(bundle);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ total: expected.length, gaps: expected });
  });

  it("narrows with --project and --owner", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);

    const { stdout } = await archidocs(repoRoot, "gaps", "--project", "shop", "--owner", "payments-team");

    expect(stdout).toBe("## shop\n### payments-team\n- service shop:fraud-check: description, technology, repository, deployments\n- relationship shop:fraud-check -> payments:payments-api: technology\n");
  });

  it("exits 0 when there are no gaps", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);

    expect(await archidocs(repoRoot, "gaps", "--project", "platform")).toEqual({ code: 0, stdout: "No gaps.\n", stderr: "" });
  });

  it("exits 1 with the check errors when the Workspace has errors", async () => {
    const { repoRoot } = await writeWorkspace({ ...validWorkspace, "shop/more.yaml": "services:\n  cart:\n    name: Cart\n    owner: storefront\n" });

    const { code, stdout, stderr } = await archidocs(repoRoot, "gaps");

    expect(code).toBe(1);
    expect(stdout).toContain("unknown-team");
    expect(stderr).toBe("Not listing gaps: the Workspace has errors.\n");
  });

  it("exits 2 for an unknown Project or Team", async () => {
    const { repoRoot } = await writeWorkspace(landscapeWorkspace);

    const team = await archidocs(repoRoot, "gaps", "--owner", "payment-team");
    expect(team.code).toBe(2);
    expect(team.stderr).toContain('archidocs: Unknown Team "payment-team"; did you mean "payments-team"?');
    expect((await archidocs(repoRoot, "gaps", "--project", "nope")).stderr).toContain('archidocs: Unknown Project "nope".');
  });
});
