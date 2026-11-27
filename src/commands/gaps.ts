import { listGaps, type Gap, type GapFilter, type Issue } from "../core/index.ts";
import type { Bundle } from "../schema/bundle.ts";
import type { Checkout } from "../workspace/index.ts";

export type GapsResult =
  /** The Workspace has errors, so it has no Bundle to scan. */
  | { kind: "errors"; issues: Issue[] }
  /** The filter names a Project or Team the Workspace doesn't have. */
  | { kind: "unknown"; what: "Project" | "Team"; id: string; known: string[] }
  /** The gaps, possibly none, with the Bundle they were found in. */
  | { kind: "gaps"; gaps: Gap[]; bundle: Bundle };

/** What the Workspace's Model leaves empty, optionally for one Project or Owner Team. */
export async function gaps(checkout: Checkout, filter: GapFilter = {}): Promise<GapsResult> {
  const { bundle, issues } = await checkout.load();
  if (issues.some((i) => i.severity === "error")) return { kind: "errors", issues };
  const projects = bundle.projects.map((p) => p.id);
  if (filter.project !== undefined && !projects.includes(filter.project)) return { kind: "unknown", what: "Project", id: filter.project, known: projects };
  const teams = bundle.teams.map((t) => t.id);
  if (filter.owner !== undefined && !teams.includes(filter.owner)) return { kind: "unknown", what: "Team", id: filter.owner, known: teams };
  return { kind: "gaps", gaps: listGaps(bundle, filter), bundle };
}
