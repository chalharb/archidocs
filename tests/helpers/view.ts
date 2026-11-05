/** Build a complete DiagramView in memory (no filesystem), for component tests. */
import { resolveDiagram } from "@/domain/diagram-resolve";
import { resolveLayout } from "@/domain/layout/positions";
import { resolveLayoutSettings } from "@/domain/layout/settings";
import type { CanonicalDiagramLayout } from "@/domain/model";
import type { DiagramView } from "@/server/workspace/repository";
import { BASE_TYPES, buildModel, res } from "./model";

export const VIEW_ENTITIES = res(
  "EntitySet",
  `id: es
entities:
  - {id: sys, name: Payments, type: software-system}
  - {id: api, name: Payments API, type: container, parent: sys, technology: Go, description: Takes payments}
  - {id: db, name: Ledger, type: database, parent: sys}
  - {id: user, name: Customer, type: person}`,
);

export const VIEW_RELATIONSHIPS = res(
  "RelationshipSet",
  `id: rs
relationships:
  - {id: user-api, type: uses, source: user, target: api, description: Pays}
  - {id: api-db, type: reads, source: api, target: db, technology: SQL}`,
);

export function makeView(
  options: {
    saved?: Partial<CanonicalDiagramLayout>;
    persistence?: Partial<DiagramView["persistence"]>;
    nodes?: string;
    modelStatus?: DiagramView["modelStatus"];
  } = {},
): DiagramView {
  const { model } = buildModel({
    "types.yaml": BASE_TYPES,
    "e.yaml": VIEW_ENTITIES,
    "r.yaml": VIEW_RELATIONSHIPS,
    "d.yaml": res(
      "Diagram",
      `id: d
name: Payments
diagramType: c4-container
nodes: ${options.nodes ?? "[{entity: sys}, {entity: api}, {entity: db}, {entity: user}]"}
edges: [{relationship: user-api}, {relationship: api-db}]`,
    ),
  });
  const { diagram, diagnostics } = resolveDiagram(model, "d");
  const layout: CanonicalDiagramLayout = {
    diagram: "d",
    settings: {},
    nodes: {
      sys: { x: 0, y: 200, width: 600, height: 300 },
      api: { x: 40, y: 260 },
      db: { x: 300, y: 260 },
      user: { x: 40, y: 0 },
    },
    edges: {},
    ...options.saved,
  };
  const settings = resolveLayoutSettings({ layout: layout.settings });
  const { diagnostics: layoutDiagnostics, ...resolved } = resolveLayout({
    diagram: diagram!,
    layout,
    settings: settings.settings,
  });
  return {
    modelStatus: options.modelStatus ?? "valid",
    diagram: diagram!,
    settings,
    inheritedSettings: resolveLayoutSettings({}).settings,
    layout: resolved,
    saved: { settings: layout.settings, nodes: layout.nodes, edges: layout.edges },
    diagnostics: [...diagnostics, ...layoutDiagnostics],
    persistence: {
      layoutFile: "d.layout.yaml",
      writable: true,
      revision: `sha256:${"a".repeat(64)}`,
      draft: null,
      ...options.persistence,
    },
  };
}
