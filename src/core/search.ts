import type { Bundle, BundleElement } from "../schema/bundle.ts";

/** 0 for an exact match, 1 for a prefix (or a URL below a Deployment's), 2 for a substring. */
export type MatchRank = 0 | 1 | 2;

/** One Element `search` found. `deployment` says which URL matched, when a URL matched better than the id or name. */
export interface SearchMatch {
  element: BundleElement;
  rank: MatchRank;
  deployment?: { environment: string; target: string; url: string };
}

export interface SearchOptions {
  kind?: BundleElement["kind"];
  /** Also match each Element's technology, or its Owner's id or name; the viewer's Find asks for both. */
  fields?: readonly ("team" | "technology")[];
}

/**
 * Finds Elements whose qualified id, bare id or name (and, when asked, technology
 * or Owner, ranked as a substring) contains `query`, and
 * Services one of whose Deployment URLs (`url` or an endpoint) matches it,
 * all case-insensitively. A URL matches as a whole, without its scheme, by
 * its host, or as the start of a longer URL below it; a trailing slash is
 * ignored. Exact matches come first, then prefixes, then substrings, each by id.
 */
export function search(bundle: Bundle, query: string, options: SearchOptions = {}): SearchMatch[] {
  const q = normalise(query);
  const urls = new Map<string, { environment: string; target: string; url: string }[]>();
  for (const d of bundle.deployments) {
    const list = urls.get(d.service) ?? [];
    for (const url of [d.url, ...d.endpoints.map((e) => e.url)]) if (url) list.push({ environment: d.environment, target: d.target, url });
    urls.set(d.service, list);
  }

  const teamNames = new Map(bundle.teams.map((t) => [t.id, t.name]));
  const extra = (e: BundleElement): string[] => [
    ...(options.fields?.includes("team") ? [e.owner, teamNames.get(e.owner) ?? ""] : []),
    ...(options.fields?.includes("technology") && "technology" in e && e.technology ? [e.technology] : []),
  ];

  const matches: SearchMatch[] = [];
  for (const element of bundle.elements) {
    if (options.kind && element.kind !== options.kind) continue;
    const byName = nameRank(q, element) ?? (rankAgainst(q, extra(element).map((f) => f.toLowerCase())) === undefined ? undefined : 2);
    let best: SearchMatch | undefined = byName === undefined ? undefined : { element, rank: byName };
    for (const deployment of urls.get(element.id) ?? []) {
      const rank = urlRank(q, deployment.url);
      if (rank !== undefined && (best === undefined || rank < best.rank)) best = { element, rank, deployment };
    }
    if (best) matches.push(best);
  }
  return matches.sort((a, b) => a.rank - b.rank || (a.element.id < b.element.id ? -1 : a.element.id > b.element.id ? 1 : 0));
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "");

function nameRank(q: string, e: BundleElement): MatchRank | undefined {
  const fields = [e.id, e.id.slice(e.id.indexOf(":") + 1), e.name].map((f) => f.toLowerCase());
  return rankAgainst(q, fields);
}

function urlRank(q: string, url: string): MatchRank | undefined {
  const full = normalise(url);
  const bare = full.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = bare.replace(/[/?#].*$/, "");
  if (q === full || q === bare || q === host) return 0;
  if ([full, bare].some((f) => /^[/?#]/.test(q.slice(f.length)) && q.startsWith(f))) return 1;
  return rankAgainst(q, [full, bare]);
}

function rankAgainst(q: string, fields: string[]): MatchRank | undefined {
  if (fields.some((f) => f === q)) return 0;
  if (fields.some((f) => f.startsWith(q))) return 1;
  if (fields.some((f) => f.includes(q))) return 2;
  return undefined;
}
