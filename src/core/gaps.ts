import type { Bundle, BundleElement } from "../schema/bundle.ts";
import { cmp } from "./query.ts";

/** The fields a gap can name. `api-docs` and `deployments` are not fields but what the Model lacks. */
export const gapNames = ["description", "technology", "repository", "deployments", "api-docs", "channel", "url"] as const;
export type GapName = (typeof gapNames)[number];

export type GapItemKind = "element" | "relationship" | "deployment";

/**
 * One item the Model leaves incomplete. `item.id` is the Element's id, a
 * Relationship as `<from> -> <to>`, or a Deployment as
 * `<service> in <environment> on <target>`.
 */
export interface Gap {
  project: string;
  owner: string;
  item: { kind: GapItemKind; id: string };
  missing: GapName[];
}

export interface GapFilter {
  /** Only this Project's gaps. */
  project?: string;
  /** Only the gaps of items this Team owns. */
  owner?: string;
}

const API_DOCS = /api|openapi|swagger/i;

const projectOf = (id: string) => id.split(":")[0]!;

/** A Service the organization runs: not External, and an application rather than a datastore or broker. */
const isApp = (e: BundleElement | undefined) => e?.kind === "service" && !e.external && e.type === "app";

/** Empty: unset, or set to nothing. */
const empty = (value: string | null | undefined) => value === null || value === undefined || value === "";

/**
 * Every gap in the Model: the fields a reader would expect filled and finds
 * empty, as the table under "What counts as a gap" in the fill-gaps guide
 * sets them out.
 *
 * - Every Element: `description`.
 * - A Service or Component: `technology`.
 * - A Service you run (`type: app`, not External): `repository`.
 * - A Service not External: `deployments` when it has none.
 * - A Service you run that a non-Person calls: `api-docs` when no `links`
 *   label and no Deployment `endpoints` name matches api, openapi or swagger.
 * - A Relationship: `description`, `technology`; an async one also `channel`.
 * - A Deployment of a Service you run: `url`.
 *
 * Ordered by Project, then Owner Team; within a Team, Elements, then
 * Relationships, then Deployments, each in Bundle order. A Gap names its
 * Project by the item's id (a Relationship by its consumer's, a Deployment by
 * its Service's) and its Owner as the item's effective Owner. Gaps are never
 * part of `check`: a gap is incompleteness, not an error.
 */
export function listGaps(bundle: Bundle, filter: GapFilter = {}): Gap[] {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const deploymentsOf = new Map<string, Bundle["deployments"]>();
  for (const d of bundle.deployments) deploymentsOf.set(d.service, [...(deploymentsOf.get(d.service) ?? []), d]);
  const called = new Set(bundle.relationships.filter((r) => byId.get(r.from)?.kind !== "person").map((r) => r.to));

  const gaps: Gap[] = [];
  const add = (project: string, owner: string, kind: GapItemKind, id: string, missing: (GapName | false)[]) => {
    const names = missing.filter((m): m is GapName => m !== false);
    if (names.length) gaps.push({ project, owner, item: { kind, id }, missing: names });
  };

  for (const e of bundle.elements) {
    const runs = deploymentsOf.get(e.id) ?? [];
    const app = isApp(e);
    const documented = () => [...e.links.map((l) => l.label), ...runs.flatMap((d) => d.endpoints.map((p) => p.name))].some((name) => API_DOCS.test(name));
    add(projectOf(e.id), e.owner, "element", e.id, [
      empty(e.description) && "description",
      (e.kind === "service" || e.kind === "component") && empty(e.technology) && "technology",
      app && e.kind === "service" && empty(e.repository) && "repository",
      e.kind === "service" && !e.external && runs.length === 0 && "deployments",
      app && called.has(e.id) && !documented() && "api-docs",
    ]);
  }
  for (const r of bundle.relationships) {
    add(projectOf(r.from), byId.get(r.from)?.owner ?? "", "relationship", `${r.from} -> ${r.to}`, [
      empty(r.description) && "description",
      empty(r.technology) && "technology",
      r.interaction === "async" && empty(r.channel) && "channel",
    ]);
  }
  for (const d of bundle.deployments) {
    if (!isApp(byId.get(d.service))) continue;
    add(projectOf(d.service), d.owner, "deployment", `${d.service} in ${d.environment} on ${d.target}`, [empty(d.url) && "url"]);
  }

  // A stable sort keeps each Team's items in the order above.
  return gaps
    .filter((g) => (filter.project === undefined || g.project === filter.project) && (filter.owner === undefined || g.owner === filter.owner))
    .sort((a, b) => cmp(a.project, b.project) || cmp(a.owner, b.owner));
}

/**
 * Gaps as Markdown: a `##` heading per Project, a `###` heading per Owner
 * Team, and one line per item naming its empty fields. An Element is named
 * by its kind and id, `service shop:web`, so `bundle` is the one the gaps
 * came from. No gaps print nothing.
 */
export function formatGaps(gaps: Gap[], bundle: Pick<Bundle, "elements">): string {
  const kindOf = new Map(bundle.elements.map((e) => [e.id, e.kind]));
  const lines: string[] = [];
  let project: string | undefined;
  let owner: string | undefined;
  for (const g of gaps) {
    if (g.project !== project) {
      lines.push(`## ${g.project}`);
      project = g.project;
      owner = undefined;
    }
    if (g.owner !== owner) {
      lines.push(`### ${g.owner}`);
      owner = g.owner;
    }
    const name = g.item.kind === "element" ? `${kindOf.get(g.item.id) ?? "element"} ${g.item.id}` : `${g.item.kind} ${g.item.id}`;
    lines.push(`- ${name}: ${g.missing.join(", ")}`);
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}
