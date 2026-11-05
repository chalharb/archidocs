/**
 * Deterministic `.layout.yaml` serialization (P0-08, LAYOUT-08).
 * The same layout always produces byte-identical output, so saves are
 * Git-friendly and round-trip through the parser unchanged.
 */
import { stringify } from "yaml";
import type { Diagnostic } from "../diagnostics";
import type { CanonicalDiagramLayout } from "../model";
import { compareCodePoints } from "../order";
import { DEFAULT_PARSE_LIMITS, parseResources, type ParseLimits } from "../parse";
import {
  API_VERSION,
  type DiagramLayoutResource,
  type EdgePresentation,
  type LayoutSettingsOverrides,
  type NodePlacement,
} from "../resources";
import { LAYOUT_SETTING_KEYS } from "./settings";

export const LAYOUT_FILE_SUFFIX = ".layout.yaml";

export const LAYOUT_FILE_HEADER =
  "# Diagram layout overrides managed by Architecture Docs.\n" +
  "# Presentation only: canonical entities and relationships live in the other YAML files.\n";

/** Avoid "-0" and float noise in saved coordinates. */
function clean(n: number): number {
  const rounded = Math.round(n * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function orderedSettings(settings: LayoutSettingsOverrides): LayoutSettingsOverrides {
  const out: Record<string, unknown> = {};
  for (const key of LAYOUT_SETTING_KEYS) if (settings[key] !== undefined) out[key] = settings[key];
  return out as LayoutSettingsOverrides;
}

export function toLayoutResource(layout: CanonicalDiagramLayout): DiagramLayoutResource {
  const resource: DiagramLayoutResource = {
    apiVersion: API_VERSION,
    kind: "DiagramLayout",
    diagram: layout.diagram,
  };
  const settings = orderedSettings(layout.settings);
  if (Object.keys(settings).length > 0) resource.settings = settings;

  const nodeIds = Object.keys(layout.nodes).sort(compareCodePoints);
  if (nodeIds.length > 0) {
    resource.nodes = {};
    for (const id of nodeIds) {
      const n = layout.nodes[id]!;
      const placement: NodePlacement = { x: clean(n.x), y: clean(n.y) };
      if (n.width !== undefined) placement.width = clean(n.width);
      if (n.height !== undefined) placement.height = clean(n.height);
      resource.nodes[id] = placement;
    }
  }
  const edgeIds = Object.keys(layout.edges)
    .filter(
      (id) => layout.edges[id]!.type !== undefined || layout.edges[id]!.animated !== undefined,
    )
    .sort(compareCodePoints);
  if (edgeIds.length > 0) {
    resource.edges = {};
    for (const id of edgeIds) {
      const e = layout.edges[id]!;
      const presentation: EdgePresentation = {};
      if (e.type !== undefined) presentation.type = e.type;
      if (e.animated !== undefined) presentation.animated = e.animated;
      resource.edges[id] = presentation;
    }
  }
  return resource;
}

export function serializeLayout(layout: CanonicalDiagramLayout): string {
  return (
    LAYOUT_FILE_HEADER +
    stringify(toLayoutResource(layout), { indent: 2, lineWidth: 0, sortMapEntries: false })
  );
}

/** Parse layout file content that must contain exactly one DiagramLayout document. */
export function parseLayoutFile(
  content: string,
  file: string,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS,
): { layout?: CanonicalDiagramLayout; diagnostics: Diagnostic[]; otherResources: number } {
  const { resources, diagnostics } = parseResources(content, file, limits);
  const layouts = resources.filter((r) => r.resource.kind === "DiagramLayout");
  const first = layouts[0]?.resource as DiagramLayoutResource | undefined;
  return {
    ...(first
      ? {
          layout: {
            diagram: first.diagram,
            settings: { ...(first.settings ?? {}) },
            nodes: { ...(first.nodes ?? {}) },
            edges: { ...(first.edges ?? {}) },
          },
        }
      : {}),
    diagnostics,
    otherResources: resources.length - (first ? 1 : 0),
  };
}
