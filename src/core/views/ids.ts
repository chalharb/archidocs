import type { Bundle } from "../../schema/bundle.ts";

/**
 * A View id taken apart. The grammar:
 * - `c1`, `c2`: the two Landscapes;
 * - `c2/<system>`, `c3/<service>`: one Element's Generated View;
 * - `deployment/<environment>`: one Environment's Generated Deployment View;
 * - `project:view-id`: a Saved View, by its Qualified id.
 */
export type ViewRef =
  | { form: "landscape"; level: "c1" | "c2" }
  | { form: "focused"; level: "c2" | "c3"; element: string }
  | { form: "deployment"; environment: string }
  | { form: "saved"; id: string };

/**
 * Reads a View id by its form alone, without a Bundle: it says what the id
 * would name, not whether that View exists. Undefined for a string in none of
 * the forms.
 */
export function parseViewId(id: string): ViewRef | undefined {
  if (id === "c1" || id === "c2") return { form: "landscape", level: id };
  const slash = id.indexOf("/");
  const scope = slash < 0 ? undefined : id.slice(0, slash);
  const rest = id.slice(slash + 1);
  if (scope === "c2" || scope === "c3") return rest === "" ? undefined : { form: "focused", level: scope, element: rest };
  if (scope === "deployment") return rest === "" ? undefined : { form: "deployment", environment: rest };
  return slash < 0 && id.includes(":") ? { form: "saved", id } : undefined;
}

/** Writes a View id; the inverse of `parseViewId`. */
export function formatViewId(ref: ViewRef): string {
  if (ref.form === "landscape") return ref.level;
  if (ref.form === "focused") return `${ref.level}/${ref.element}`;
  if (ref.form === "deployment") return `deployment/${ref.environment}`;
  return ref.id;
}

/**
 * An Element's own Generated View: `c2/<system>` for a System, `c3/<service>`
 * for a Service with Components, else the `c2/<system>` of the System it sits
 * in. Undefined for an unknown Element or one outside any System.
 */
export function ownViewId(bundle: Bundle, element: string): string | undefined {
  const byId = new Map(bundle.elements.map((e) => [e.id, e]));
  const own = byId.get(element);
  if (!own) return undefined;
  if (own.kind === "service" && bundle.elements.some((e) => e.parent === element)) return formatViewId({ form: "focused", level: "c3", element });
  const seen = new Set<string>();
  for (let e = own; !seen.has(e.id); ) {
    if (e.kind === "system") return formatViewId({ form: "focused", level: "c2", element: e.id });
    seen.add(e.id);
    const parent = e.parent === null ? undefined : byId.get(e.parent);
    if (!parent) break;
    e = parent;
  }
  return undefined;
}
