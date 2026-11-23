import type { Bundle, BundleDeployment, BundleTarget } from "../schema/bundle.ts";

/** One Deployment Target in a chain: enough to name it. */
export interface TargetStep {
  id: string;
  name: string;
  kind: string;
}

/** A Deployment with its full Deployment Target chain, outermost first, ending at its own Target. */
export interface DeploymentDetail extends BundleDeployment {
  targetPath: TargetStep[];
}

/**
 * A Service's Deployments, optionally in one Environment, each with the chain
 * of Deployment Targets it sits in (e.g. region › cluster). Ordered as in the
 * Bundle: by Environment, then Target. A Target the Bundle does not know
 * leaves the chain empty.
 */
export function getDeployments(bundle: Bundle, service: string, environment?: string): DeploymentDetail[] {
  const targets = new Map(bundle.targets.map((t) => [t.id, t]));
  return bundle.deployments
    .filter((d) => d.service === service && (environment === undefined || d.environment === environment))
    .map((d) => ({ ...d, targetPath: chain(targets, d.target) }));
}

function chain(targets: Map<string, BundleTarget>, id: string): TargetStep[] {
  const path: TargetStep[] = [];
  const seen = new Set<string>();
  for (let t = targets.get(id); t && !seen.has(t.id); t = t.parent === null ? undefined : targets.get(t.parent)) {
    seen.add(t.id);
    path.unshift({ id: t.id, name: t.name, kind: t.kind });
  }
  return path;
}
