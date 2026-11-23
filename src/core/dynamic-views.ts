import type { Bundle, BundleDynamicView, BundleElement, BundleRelationship, BundleStep } from "../schema/bundle.ts";
import { within } from "./query.ts";

/** How a Step reads: a consumer calling its provider, the provider's reply, or an event a publisher sends one subscriber. */
export type StepKind = "call" | "return" | "event";

/**
 * One Step resolved to the Relationship it takes. `from` and `to` are as
 * drawn: for an event, publisher → subscriber, while `relationship` is the
 * stored subscriber → publisher subscription. `via` and `channel` are copied
 * from the Relationship when it has them.
 */
export interface ResolvedStep {
  /** The Step's position in the View, from 1. */
  n: number;
  kind: StepKind;
  from: string;
  to: string;
  relationship: BundleRelationship;
  interaction: "sync" | "async";
  via?: string;
  channel?: string;
  /** The author's description, else the channel for an event, else the Relationship's description. */
  description: string;
  note?: string;
}

/** A Dynamic View resolved: its participants in drawing order and the Steps that resolve, numbered by position. */
export interface ResolvedDynamicView {
  id: string;
  kind: "dynamic";
  title: string;
  participants: string[];
  steps: ResolvedStep[];
}

/** A problem `check` reports about a Dynamic View, at a path relative to the View. */
export interface DynamicProblem {
  rule: "missing-step" | "ambiguous-step" | "return-without-relationship" | "return-on-async" | "ancestor-descendant-participants";
  at: (string | number)[];
  message: string;
}

export interface DynamicResolution {
  view: ResolvedDynamicView;
  problems: DynamicProblem[];
}

const kindName: Record<BundleElement["kind"], string> = { person: "Person", system: "System", service: "Service", component: "Component" };

const nameOf = (r: BundleRelationship) => r.id ?? `${r.from} → ${r.to}`;
const names = (rs: BundleRelationship[]) => rs.map(nameOf).join(", ");

/**
 * Resolves a Dynamic View's Steps against the Model. Each Step's ends may be
 * any Elements; a Relationship between their descendants (a derived edge)
 * counts as between them.
 * - A non-return Step collects the forward Relationships `from` → `to`
 *   without `via` (calls) and the `via` subscriptions `to` → `from` (events).
 *   Exactly one match is the Step; more is ambiguous unless `relationship`
 *   names one.
 * - A return Step needs a Relationship `to` → `from`, and it must be sync.
 * Steps naming an unknown Element, or an Element and its own ancestor, are
 * left out without a Step problem (`unknown-element` and
 * `ancestor-descendant-participants` report them).
 */
export function resolveDynamic(bundle: Bundle, def: BundleDynamicView): DynamicResolution {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const under = within(bundle);
  const problems: DynamicProblem[] = [];
  const steps: ResolvedStep[] = [];

  def.steps.forEach((s, index) => {
    const result = resolveStep(bundle, s, under, byId);
    if (result === undefined) return;
    if ("rule" in result) problems.push({ rule: result.rule, at: ["steps", index], message: result.message });
    else steps.push(toStep(index + 1, s, result.kind, result.relationship));
  });

  // Participants in the order they first appear: the fixed list first, then each Step's ends.
  const appearances: { id: string; at: (string | number)[] }[] = [
    ...(def.participants ?? []).map((id, i) => ({ id, at: ["participants", i] })),
    ...def.steps.flatMap((s, i) => (["from", "to"] as const).map((end) => ({ id: s[end], at: ["steps", i, end] }))),
  ].filter((a) => byId.has(a.id));
  const first = new Map<string, (string | number)[]>();
  for (const a of appearances) if (!first.has(a.id)) first.set(a.id, a.at);
  const participants = [...first.keys()];

  // An ancestor and its descendant both taking part is reported once, where the later of the two first appears.
  participants.forEach((later, j) => {
    for (const earlier of participants.slice(0, j)) {
      const [ancestor, descendant] = under(later, earlier) ? [earlier, later] : under(earlier, later) ? [later, earlier] : [];
      if (ancestor === undefined || descendant === undefined) continue;
      problems.push({
        rule: "ancestor-descendant-participants",
        at: first.get(later)!,
        message: `${kindName[byId.get(ancestor)!.kind]} "${ancestor}" and its descendant "${descendant}" are both participants`,
      });
    }
  });

  return { view: { id: def.id, kind: "dynamic", title: def.title, participants, steps }, problems };
}

/** Resolves a Saved Dynamic View by id; undefined for any other id. */
export function resolveDynamicView(bundle: Bundle, id: string): ResolvedDynamicView | undefined {
  const def = bundle.views.find((v) => v.id === id);
  return def?.kind === "dynamic" ? resolveDynamic(bundle, def).view : undefined;
}

/** Whether an Element takes part in a Dynamic View: as a participant, or as the broker an event Step runs via. */
export function takesPart(view: ResolvedDynamicView, element: string): boolean {
  return view.participants.includes(element) || view.steps.some((s) => s.via === element);
}

type StepResult = { kind: StepKind; relationship: BundleRelationship } | { rule: DynamicProblem["rule"]; message: string } | undefined;

function resolveStep(bundle: Bundle, s: BundleStep, under: (id: string, root: string) => boolean, byId: Map<string, BundleElement>): StepResult {
  const { from, to } = s;
  if (!byId.has(from) || !byId.has(to)) return undefined;
  if (from === to) return { rule: "missing-step", message: `A Step goes from one Element to another, not from "${from}" to itself` };
  if (under(from, to) || under(to, from)) return undefined;
  const named = s.relationship === null ? undefined : bundle.relationships.filter((r) => r.id === s.relationship);
  if (named !== undefined && named.length === 0) return { rule: "missing-step", message: `No Relationship "${s.relationship}"` };

  if (s.return) {
    const opposite = bundle.relationships.filter((r) => under(r.from, to) && under(r.to, from));
    const pick = pickOne(opposite, named, s, () => ({ rule: "return-without-relationship", message: `A return from "${from}" to "${to}" needs a Relationship from "${to}" to "${from}"` }), (n) => `${n} Relationships match the return "${from}" → "${to}"`);
    if (!("relationship" in pick)) return pick;
    if (pick.relationship.interaction === "async") {
      return { rule: "return-on-async", message: `Relationship "${nameOf(pick.relationship)}" is async, so it has no return; model a callback as its own Relationship` };
    }
    return { kind: "return", relationship: pick.relationship };
  }

  const calls = bundle.relationships.filter((r) => r.via === null && under(r.from, from) && under(r.to, to));
  const events = bundle.relationships.filter((r) => r.via !== null && under(r.from, to) && under(r.to, from));
  if (named === undefined && calls.length > 0 && events.length > 0) {
    return { rule: "ambiguous-step", message: `"${from}" → "${to}" matches both a call (${names(calls)}) and an event (${names(events)}); name one with \`relationship\`` };
  }
  const pick = pickOne([...calls, ...events], named, s, () => ({ rule: "missing-step", message: `No Relationship from "${from}" to "${to}", nor a \`via\` subscription of "${to}" to it` }), (n) => `${n} Relationships match "${from}" → "${to}"`);
  if (!("relationship" in pick)) return pick;
  return { kind: events.includes(pick.relationship) ? "event" : "call", relationship: pick.relationship };
}

/** The one candidate a Step takes: the named one if it is a candidate, else the only candidate. */
function pickOne(
  candidates: BundleRelationship[],
  named: BundleRelationship[] | undefined,
  s: BundleStep,
  none: () => { rule: DynamicProblem["rule"]; message: string },
  several: (n: number) => string,
): { relationship: BundleRelationship } | { rule: DynamicProblem["rule"]; message: string } {
  if (named !== undefined) {
    const hit = candidates.find((r) => named.includes(r));
    const [a, b] = s.return ? [s.to, s.from] : [s.from, s.to];
    return hit ? { relationship: hit } : { rule: "missing-step", message: `Relationship "${s.relationship}" doesn't connect "${a}" to "${b}"` };
  }
  if (candidates.length === 0) return none();
  if (candidates.length > 1) return { rule: "ambiguous-step", message: `${several(candidates.length)} (${names(candidates)}); name one with \`relationship\`` };
  return { relationship: candidates[0]! };
}

function toStep(n: number, s: BundleStep, kind: StepKind, r: BundleRelationship): ResolvedStep {
  const label = kind === "event" ? (r.channel ?? r.description) : r.description;
  return {
    n,
    kind,
    from: s.from,
    to: s.to,
    relationship: r,
    interaction: r.interaction,
    ...(r.via === null ? {} : { via: r.via }),
    ...(r.channel === null ? {} : { channel: r.channel }),
    description: s.description ?? label ?? "",
    ...(s.note === null ? {} : { note: s.note }),
  };
}
