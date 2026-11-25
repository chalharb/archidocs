import type { Bundle, BundleDeployment } from "../schema/bundle.ts";

/** An item as text, leaving out where it was written. */
export const withoutSource = (item: object) => JSON.stringify({ ...item, source: undefined });

/** Items of both sides, each once: the later side's where both have it. */
function union<T>(before: T[], after: T[], key: (item: T) => string): T[] {
  const keys = new Set(after.map(key));
  return [...after, ...before.filter((item) => !keys.has(key(item)))];
}

const byId = (item: { id: string }) => item.id;
const deploymentKey = (d: BundleDeployment) => `${d.service}\0${d.environment}\0${d.target}`;

/**
 * One Bundle holding everything either side holds, the later side's version
 * where both do, so a View drawn from it keeps removed things in place.
 * Relationships are matched by their whole content, so a changed one shows
 * at both sides; each lands on the same edge.
 */
export function unionBundle(before: Bundle, after: Bundle): Bundle {
  return {
    ...after,
    teams: union(before.teams, after.teams, byId),
    environments: union(before.environments, after.environments, byId),
    projects: union(before.projects, after.projects, byId),
    elements: union(before.elements, after.elements, byId),
    relationships: union(before.relationships, after.relationships, withoutSource),
    targets: union(before.targets, after.targets, byId),
    deployments: union(before.deployments, after.deployments, deploymentKey),
    views: union(before.views, after.views, byId),
    adrs: union(before.adrs, after.adrs, byId),
  };
}
