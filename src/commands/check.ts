import type { Issue } from "../core/index.ts";
import type { Checkout } from "../workspace/index.ts";

export type CheckResult = { kind: "checked"; issues: Issue[] };

/** The Workspace's issues. */
export async function check(checkout: Checkout): Promise<CheckResult> {
  const { issues } = await checkout.load();
  return { kind: "checked", issues };
}
