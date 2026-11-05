/**
 * Effective element and relationship styles (DIAG-11, ADD-004).
 *
 * Per key, later wins: built-in defaults → type ancestry (root type first,
 * down to the element's own type) → the element's own `style`. Styles are
 * computed per canonical element, so every view instance looks the same.
 */
import { ancestry } from "./hierarchy";
import type { ArchitectureModel, CanonicalEntity, CanonicalRelationship } from "./model";
import type { ElementShape, LineStyle, StyleColor } from "./resources";

export interface EffectiveElementStyle {
  shape: ElementShape;
  color: StyleColor;
}

export interface EffectiveRelationshipStyle {
  line: LineStyle;
  color: StyleColor;
}

export const DEFAULT_ELEMENT_STYLE: Readonly<EffectiveElementStyle> = Object.freeze({
  shape: "rectangle",
  color: "primary",
});

export const DEFAULT_RELATIONSHIP_STYLE: Readonly<EffectiveRelationshipStyle> = Object.freeze({
  line: "dashed",
  color: "gray",
});

function merge<T extends object>(base: T, layers: ReadonlyArray<Partial<T> | undefined>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export function effectiveElementStyle(
  model: Pick<ArchitectureModel, "entityTypes">,
  entity: Pick<CanonicalEntity, "type" | "style">,
): EffectiveElementStyle {
  const chain = ancestry(model.entityTypes, entity.type).reverse();
  return merge({ ...DEFAULT_ELEMENT_STYLE }, [
    ...chain.map((t) => model.entityTypes[t]?.style),
    entity.style,
  ]);
}

export function effectiveRelationshipStyle(
  model: Pick<ArchitectureModel, "relationshipTypes">,
  relationship: Pick<CanonicalRelationship, "type" | "style">,
): EffectiveRelationshipStyle {
  const chain = ancestry(model.relationshipTypes, relationship.type).reverse();
  return merge({ ...DEFAULT_RELATIONSHIP_STYLE }, [
    ...chain.map((t) => model.relationshipTypes[t]?.style),
    relationship.style,
  ]);
}
