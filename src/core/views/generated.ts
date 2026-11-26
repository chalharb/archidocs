import type { Bundle, BundleElement, BundleRelationship } from "../../schema/bundle.ts";
import { resolveDeployment } from "./deployment.ts";
import { formatViewId, parseViewId } from "./ids.ts";
import { build, type ModelIndex } from "./model.ts";
import type { ResolvedView, ViewKind, ViewSummary } from "./types.ts";

/**
 * Resolves a Generated View by id: `c1`, `c2`, `c2/<system>`, `c3/<service>`
 * (only for a Service with Components) or `deployment/<env>`. Undefined for
 * any other id, and for one naming an Element or Environment that isn't there.
 * The C2 Landscape opens every System but those in `collapse`; `collapse`
 * applies to no other View.
 */
export function resolveGenerated(bundle: Bundle, model: ModelIndex, id: string, expand: readonly string[], collapse: readonly string[] = []): ResolvedView | undefined {
  const ref = parseViewId(id);
  if (ref === undefined || ref.form === "saved") return undefined;
  if (ref.form === "landscape") return ref.level === "c1" ? landscape(model, "c1", "C1 Landscape", []) : landscape(model, "c2", "C2 Landscape", [...systemsOpen(model, collapse), ...expand]);
  if (ref.form === "deployment") {
    const env = bundle.environments.find((e) => e.id === ref.environment);
    return env ? resolveDeployment(bundle, model, { id, title: `${env.name} (Deployment)` }, env.id) : undefined;
  }
  const focus = model.byId.get(ref.element);
  if (!focus) return undefined;
  if (ref.level === "c2" && focus.kind === "system") return focused(model, { id, kind: "c2", title: `${focus.name} (C2)` }, focus, expand);
  if (ref.level === "c3" && focus.kind === "service" && model.children(focus.id).length > 0) return focused(model, { id, kind: "c3", title: `${focus.name} (C3)` }, focus, expand);
  return undefined;
}

/**
 * Every Generated View's id, in the order `c1`, `c2`, then `c2/<system>` and
 * `c3/<service>` by id, then `deployment/<env>` by Environment id.
 */
export function generatedViewIds(bundle: Bundle): string[] {
  const parents = new Set(bundle.elements.map((e) => e.parent));
  const ids = (level: "c2" | "c3", keep: (e: BundleElement) => boolean) => [...new Set(bundle.elements.filter(keep).map((e) => formatViewId({ form: "focused", level, element: e.id })))].sort();
  const deployment = bundle.environments.map((e) => formatViewId({ form: "deployment", environment: e.id })).sort();
  return ["c1", "c2", ...ids("c2", (e) => e.kind === "system"), ...ids("c3", (e) => e.kind === "service" && parents.has(e.id)), ...deployment];
}

/** A Generated View's id, kind and title without resolving it; `id` must be one `generatedViewIds` gave. */
export function summarise(id: string, bundle: Bundle): ViewSummary & { kind: ViewKind } {
  const ref = parseViewId(id)!;
  if (ref.form === "landscape") return { id, kind: ref.level, title: ref.level === "c1" ? "C1 Landscape" : "C2 Landscape" };
  if (ref.form === "deployment") return { id, kind: "deployment", title: `${bundle.environments.find((e) => e.id === ref.environment)!.name} (Deployment)` };
  if (ref.form === "saved") throw new Error(`"${id}" is not a Generated View id`);
  return { id, kind: ref.level, title: `${bundle.elements.find((e) => e.id === ref.element)!.name} (${ref.level.toUpperCase()})` };
}

/** Every System not in `collapse`: the boxes the C2 Landscape opens before its `expand`. */
function systemsOpen(model: ModelIndex, collapse: readonly string[]): string[] {
  const closed = new Set(collapse);
  return model.elements.filter((e) => e.kind === "system" && !closed.has(e.id)).map((e) => e.id);
}

/** Every top-level Element, each standing for everything beneath it, with the `expand`ed boxes open. */
function landscape(model: ModelIndex, kind: ViewKind, title: string, expand: readonly string[]): ResolvedView {
  const shown = new Set(model.elements.filter((e) => e.parent === null).map((e) => e.id));
  open(model, shown, expand);
  return build(model, { id: kind, kind, title }, shown, () => true);
}

/** Adds the children of each `expand`ed System or Service that is shown, repeating so a Service opens once its System has. */
function open(model: ModelIndex, shown: Set<string>, expand: readonly string[]): void {
  const pending = new Set(expand.filter((id) => ["system", "service"].includes(model.byId.get(id)?.kind ?? "")));
  for (let grew = true; grew; ) {
    grew = false;
    for (const id of pending) {
      if (!shown.has(id)) continue;
      for (const child of model.children(id)) shown.add(child.id);
      pending.delete(id);
      grew = true;
    }
  }
}

/**
 * One Element opened as a container around its children, plus its direct
 * neighbours: every Element outside it with a Relationship to anything
 * inside it, collapsed to its highest ancestor that does not contain the
 * focus. Only Relationships touching the focus become edges.
 */
function focused(model: ModelIndex, head: Pick<ResolvedView, "id" | "kind" | "title">, focus: BundleElement, expand: readonly string[]): ResolvedView {
  const inside = (id: string) => model.ancestry(id).includes(focus.id);
  const touches = (r: BundleRelationship) => inside(r.from) || inside(r.to);
  const shown = new Set([focus.id, ...model.children(focus.id).map((c) => c.id)]);
  for (const r of model.relationships) {
    if (!touches(r)) continue;
    for (const end of [r.from, r.to]) {
      if (inside(end) || !model.byId.has(end)) continue;
      const separating = model.ancestry(end).filter((a) => !model.ancestry(focus.id).includes(a));
      shown.add(separating.at(-1)!);
    }
  }
  open(model, shown, expand);
  return build(model, head, shown, touches);
}
