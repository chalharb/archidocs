import { resolveView, type ResolveOptions, type ResolvedDynamicView, type ResolvedView } from "../../src/core/index.ts";
import type { Bundle } from "../../src/schema/bundle.ts";

/** Resolves a View a test expects to be a Structural View; undefined for an unknown id. */
export function structuralView(bundle: Bundle, id: string, options?: ResolveOptions): ResolvedView | undefined {
  const view = resolveView(bundle, id, options);
  if (view?.kind === "dynamic") throw new Error(`"${id}" is a Dynamic View, not a Structural View`);
  return view;
}

/** Resolves a View a test expects to be a Dynamic View; undefined for an unknown id. */
export function dynamicView(bundle: Bundle, id: string): ResolvedDynamicView | undefined {
  const view = resolveView(bundle, id);
  if (view !== undefined && view.kind !== "dynamic") throw new Error(`"${id}" is a Structural View, not a Dynamic View`);
  return view;
}
