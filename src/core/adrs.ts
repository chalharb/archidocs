import { AdrFrontmatter } from "../schema/adr.ts";
import type { Bundle, BundleAdr } from "../schema/bundle.ts";
import { qualifyAdr } from "./adr.ts";
import type { AdrDecl, LoadedWorkspace } from "./model.ts";
import { qualify } from "./refs.ts";

/** ADRs that make it into the Bundle: a usable Project, an `NNNN-slug.md` name, valid frontmatter, and the first file with its number. */
function bundledAdrs(ws: LoadedWorkspace): { decl: AdrDecl; id: string; frontmatter: AdrFrontmatter }[] {
  const seen = new Set<string>();
  return ws.adrs.flatMap((decl) => {
    if (decl.project.id === undefined || decl.project.duplicateOf || decl.number === undefined || !decl.frontmatter) return [];
    const parsed = AdrFrontmatter.safeParse(decl.data);
    const id = `${decl.project.id}:${decl.number}`;
    if (!parsed.success || seen.has(id)) return [];
    seen.add(id);
    return [{ decl, id, frontmatter: parsed.data }];
  });
}

/** The Bundle's `adrs` slot, by id, with `supersededBy` and the effective status derived from accepted ADRs. */
export function bundleAdrs(ws: LoadedWorkspace): BundleAdr[] {
  const adrs = bundledAdrs(ws).map(({ decl, id, frontmatter: f }) => {
    const ref = (r: string) => qualify(r, decl.project) ?? r;
    return {
      id,
      project: decl.project.id!,
      title: decl.title?.text ?? id,
      status: f.status,
      effectiveStatus: f.status,
      date: f.date,
      elements: (f.elements ?? []).map(ref),
      views: (f.views ?? []).map(ref),
      supersedes: (f.supersedes ?? []).map((r) => qualifyAdr(r, decl.project) ?? r),
      supersededBy: [] as string[],
      decisionMakers: f["decision-makers"] ?? [],
      consulted: f.consulted ?? [],
      informed: f.informed ?? [],
      tags: f.tags ?? [],
      body: decl.body,
      source: { file: decl.path, line: 1 },
    };
  });
  const byId = new Map(adrs.map((a) => [a.id, a]));
  for (const a of adrs) {
    if (a.status !== "accepted") continue;
    for (const old of a.supersedes) byId.get(old)?.supersededBy.push(a.id);
  }
  for (const a of adrs) {
    a.supersededBy.sort(cmp);
    if (a.supersededBy.length > 0) a.effectiveStatus = "superseded";
  }
  return adrs.sort((a, b) => cmp(a.id, b.id));
}

export interface ListAdrsOptions {
  /** Only ADRs that link this Element or Deployment Target, or any of its descendants (not its ancestors). */
  element?: string;
  /** Only ADRs with this effective status. */
  status?: BundleAdr["status"];
  /** Only ADRs with this tag. */
  tag?: string;
}

/** An ADR as `listAdrs` returns it; with `element`, `matchedVia` holds the linked ids that matched it. */
export type ListedAdr = BundleAdr & { matchedVia?: string[] };

/** ADRs newest first, by `date`, then by number, then by id. */
export function listAdrs(bundle: Bundle, options: ListAdrsOptions = {}): ListedAdr[] {
  const covered = options.element === undefined ? undefined : subtree(bundle, options.element);
  return bundle.adrs
    .flatMap((a): ListedAdr[] => {
      if (options.status !== undefined && a.effectiveStatus !== options.status) return [];
      if (options.tag !== undefined && !a.tags.includes(options.tag)) return [];
      if (!covered) return [a];
      const matchedVia = a.elements.filter((id) => covered.has(id));
      return matchedVia.length ? [{ ...a, matchedVia }] : [];
    })
    .sort((a, b) => cmp(b.date, a.date) || cmp(numberOf(b), numberOf(a)) || cmp(a.id, b.id));
}

/** The ADRs linked to an Element or Target directly or through its descendants, as `listAdrs` gives them. */
export const adrsFor = (bundle: Bundle, id: string) => listAdrs(bundle, { element: id });

/** `id` and every Element or Target nested under it. */
function subtree(bundle: Bundle, id: string): Set<string> {
  const items = [...bundle.elements, ...bundle.targets];
  const out = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const i of items) if (i.parent !== null && out.has(i.parent) && !out.has(i.id)) grew = Boolean(out.add(i.id));
  }
  return out;
}

const numberOf = (a: BundleAdr) => a.id.slice(a.id.indexOf(":") + 1);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
