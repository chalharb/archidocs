import type { Bundle, BundleDeployment, BundleRelationship, BundleTarget } from "../../schema/bundle.ts";
import { cmp, lifter } from "../query.ts";
import type { ModelIndex } from "./model.ts";
import type { ResolvedView, ViewEdge, ViewNode } from "./types.ts";

/** Which Deployments a Deployment View draws, and which Services it leaves out altogether. */
export interface DeploymentScope {
  /** A Deployment of the Environment is drawn when this accepts it; one that isn't counts as absent from the View. */
  deployed?: (d: BundleDeployment) => boolean;
  /** A Service this rejects is left out, with its Relationships. */
  keep?: (service: string) => boolean;
}

/** A Deployment's node id: its Service and Target, as `<service>@<target>`. */
const deploymentNodeId = (d: Pick<BundleDeployment, "service" | "target">): string => `${d.service}@${d.target}`;

/**
 * Resolves the Deployment View of one Environment:
 * - every Target holding a drawn Deployment is a container, nested in its parent Targets;
 * - inside each Target, a System's Deployments sit in a box for that System
 *   (`<system>@<target>`, drawing only); a Deployment of a Service outside any
 *   System sits in the Target itself;
 * - Relationships are lifted to Service level. A consumer Deployment connects to
 *   the provider's Deployments under their deepest shared Target, or to all of
 *   them when no Target is shared;
 * - a related Service with no drawn Deployment (such as an External provider) is a
 *   logical node outside every Target. Persons are not drawn.
 * Nodes are sorted by id, edges by `from`, then `to`.
 */
export function resolveDeployment(bundle: Bundle, model: ModelIndex, head: { id: string; title: string }, environment: string, scope: DeploymentScope = {}): ResolvedView {
  const targets = new Map(bundle.targets.map((t) => [t.id, t]));
  const keep = scope.keep ?? (() => true);
  const deployed = scope.deployed ?? (() => true);
  const drawn = bundle.deployments.filter((d) => d.environment === environment && model.byId.get(d.service)?.kind === "service" && targets.has(d.target) && keep(d.service) && deployed(d));

  const nodes = new Map<string, ViewNode>();
  const plain = { collapsed: false, external: false };
  const byService = new Map<string, { d: BundleDeployment; chain: string[] }[]>();
  for (const d of drawn) {
    const chain = chainOf(targets, d.target);
    chain.forEach((t, i) => {
      if (!nodes.has(t)) nodes.set(t, { id: t, kind: "target", name: targets.get(t)!.name, parent: chain[i - 1] ?? null, ...plain });
    });
    const system = model.ancestry(d.service).find((a) => model.byId.get(a)?.kind === "system");
    let parent = d.target;
    if (system !== undefined) {
      parent = `${system}@${d.target}`;
      const s = model.byId.get(system)!;
      nodes.set(parent, { id: parent, kind: "system", name: s.name, parent: d.target, element: system, collapsed: false, external: "external" in s && s.external });
    }
    const service = model.byId.get(d.service)!;
    nodes.set(deploymentNodeId(d), { id: deploymentNodeId(d), kind: "deployment", name: service.name, parent, element: d.service, target: d.target, collapsed: false, external: "external" in service && service.external });
    byService.set(d.service, [...(byService.get(d.service) ?? []), { d, chain }]);
  }

  const lift = lifter(bundle, "service");
  const edges = new Map<string, ViewEdge>();
  const connect = (from: string, to: string, r: BundleRelationship) => {
    const key = `${from}\0${to}`;
    const edge = edges.get(key) ?? { from, to, relationships: [] };
    edge.relationships.push(r);
    edges.set(key, edge);
  };
  const logical = (id: string) => {
    const e = model.byId.get(id)!;
    if (!nodes.has(id)) nodes.set(id, { id, kind: e.kind, name: e.name, parent: null, collapsed: false, external: "external" in e && e.external });
    return id;
  };
  for (const r of model.relationships) {
    const [from, to] = [lift(r.from), lift(r.to)];
    if (from === to || !keep(from) || !keep(to)) continue;
    if ([from, to].some((id) => !model.byId.has(id) || model.byId.get(id)!.kind === "person")) continue;
    const consumers = byService.get(from) ?? [];
    const providers = byService.get(to) ?? [];
    if (consumers.length === 0 && providers.length === 0) continue;
    if (consumers.length === 0) {
      for (const p of providers) connect(logical(from), deploymentNodeId(p.d), r);
      continue;
    }
    for (const c of consumers) {
      if (providers.length === 0) {
        connect(deploymentNodeId(c.d), logical(to), r);
        continue;
      }
      const shared = providers.map((p) => sharedDepth(c.chain, p.chain));
      const deepest = Math.max(...shared);
      providers.forEach((p, i) => {
        if (deepest === 0 || shared[i] === deepest) connect(deploymentNodeId(c.d), deploymentNodeId(p.d), r);
      });
    }
  }

  return {
    ...head,
    kind: "deployment",
    direction: "TB",
    environment,
    nodes: [...nodes.values()].sort((a, b) => cmp(a.id, b.id)),
    edges: [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to)),
  };
}

/** A Target's chain, outermost first, ending at the Target itself. */
function chainOf(targets: Map<string, BundleTarget>, id: string): string[] {
  const chain: string[] = [];
  for (let t = targets.get(id); t && !chain.includes(t.id); t = t.parent === null ? undefined : targets.get(t.parent)) chain.unshift(t.id);
  return chain;
}

/** How many Targets two chains share from the outside in. */
function sharedDepth(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
