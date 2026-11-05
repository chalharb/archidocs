/**
 * Layout editor document: the presentation state the editor changes and saves.
 *
 * The editor only ever changes presentation (positions, sizes, layout settings,
 * edge presentation) and saves it to the diagram's `.layout.yaml`; canonical
 * entities and relationships are never edited here (LAYOUT-22, SCOPE-01).
 * All coordinates are absolute canvas coordinates (ADD-006).
 */
import type { ResolvedDiagram } from "@/domain/diagram-resolve";
import { resolveLayoutSettings } from "@/domain/layout/settings";
import type {
  EdgePresentation,
  EdgeType,
  LayoutSettings,
  LayoutSettingsOverrides,
  NodePlacement,
} from "@/domain/resources";
import type { DiagramView } from "@/server/workspace/repository";
import type { LayoutEdit } from "@/server/persistence/layout-writer";
import { align, distribute, type AlignMode, type Box, type DistributeAxis } from "./geometry";

export interface EditorDoc {
  /** Current box of every node (absolute). */
  boxes: Record<string, Box>;
  /** Nodes whose position is saved as a manual override, sorted. */
  placed: string[];
  /** Layout-file setting overrides. */
  settings: LayoutSettingsOverrides;
  /** Layout-file edge overrides. */
  edges: Record<string, EdgePresentation>;
}

export type DiagramViewData = Pick<
  DiagramView,
  "diagram" | "layout" | "saved" | "inheritedSettings"
>;

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort();

export function docFromView(view: DiagramViewData): EditorDoc {
  const boxes: Record<string, Box> = {};
  for (const node of view.diagram.nodes) {
    const p = view.layout.positions[node.id];
    if (p) boxes[node.id] = { x: p.x, y: p.y, width: p.width, height: p.height };
  }
  return {
    boxes,
    placed: sorted(
      view.diagram.nodes
        .filter((n) => view.layout.positions[n.id]?.source === "manual")
        .map((n) => n.id),
    ),
    settings: { ...(view.saved.settings ?? {}) },
    edges: { ...(view.saved.edges ?? {}) },
  };
}

export function effectiveSettings(view: DiagramViewData, doc: EditorDoc): LayoutSettings {
  return resolveLayoutSettings({ workspace: view.inheritedSettings, layout: doc.settings })
    .settings;
}

export function edgeTypeOf(view: DiagramViewData, doc: EditorDoc, edgeId: string): EdgeType {
  return doc.edges[edgeId]?.type ?? effectiveSettings(view, doc).edgeType;
}

export function edgeAnimatedOf(view: DiagramViewData, doc: EditorDoc, edgeId: string): boolean {
  return doc.edges[edgeId]?.animated ?? effectiveSettings(view, doc).animateEdges;
}

/** IDs of every node inside `id`'s boundary, at any depth. */
export function descendants(diagram: ResolvedDiagram, id: string): string[] {
  const children = new Map<string, string[]>();
  for (const n of diagram.nodes)
    if (n.boundary !== undefined)
      children.set(n.boundary, [...(children.get(n.boundary) ?? []), n.id]);
  const out: string[] = [];
  const stack = [...(children.get(id) ?? [])];
  const seen = new Set<string>([id]);
  while (stack.length > 0) {
    const next = stack.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(children.get(next) ?? []));
  }
  return out;
}

/**
 * Move nodes to new top-left positions. Moving a boundary moves its contents by
 * the same amount, unless they are moved explicitly too (ADD-006).
 */
export function moveNodes(
  doc: EditorDoc,
  diagram: ResolvedDiagram,
  moves: Readonly<Record<string, { x: number; y: number }>>,
): EditorDoc {
  const ids = Object.keys(moves).filter((id) => doc.boxes[id]);
  if (ids.length === 0) return doc;
  const boxes = { ...doc.boxes };
  const touched = new Set<string>();
  for (const id of ids) {
    const before = doc.boxes[id]!;
    const { x, y } = moves[id]!;
    if (before.x === x && before.y === y) continue;
    boxes[id] = { ...before, x, y };
    touched.add(id);
    const dx = x - before.x;
    const dy = y - before.y;
    for (const child of descendants(diagram, id)) {
      if (moves[child] || !doc.boxes[child]) continue;
      const c = doc.boxes[child]!;
      boxes[child] = { ...c, x: c.x + dx, y: c.y + dy };
      touched.add(child);
    }
  }
  if (touched.size === 0) return doc;
  return { ...doc, boxes, placed: sorted([...doc.placed, ...touched]) };
}

export function resizeNode(doc: EditorDoc, id: string, box: Box): EditorDoc {
  const before = doc.boxes[id];
  if (!before) return doc;
  if (
    before.x === box.x &&
    before.y === box.y &&
    before.width === box.width &&
    before.height === box.height
  )
    return doc;
  return {
    ...doc,
    boxes: { ...doc.boxes, [id]: { ...box } },
    placed: sorted([...doc.placed, id]),
  };
}

export function alignNodes(
  doc: EditorDoc,
  diagram: ResolvedDiagram,
  ids: readonly string[],
  mode: AlignMode,
): EditorDoc {
  return moveNodes(doc, diagram, align(doc.boxes, ids, mode));
}

export function distributeNodes(
  doc: EditorDoc,
  diagram: ResolvedDiagram,
  ids: readonly string[],
  axis: DistributeAxis,
): EditorDoc {
  return moveNodes(doc, diagram, distribute(doc.boxes, ids, axis));
}

/** Replace every position with freshly generated ones (Re-layout All, LAYOUT-12/20). */
export function applyRelayout(doc: EditorDoc, generated: Readonly<Record<string, Box>>): EditorDoc {
  const boxes: Record<string, Box> = {};
  for (const id of Object.keys(doc.boxes)) boxes[id] = { ...(generated[id] ?? doc.boxes[id]!) };
  return { ...doc, boxes, placed: sorted(Object.keys(boxes)) };
}

export function setSetting<K extends keyof LayoutSettings>(
  doc: EditorDoc,
  key: K,
  value: LayoutSettings[K] | undefined,
): EditorDoc {
  const settings = { ...doc.settings };
  if (value === undefined) delete settings[key];
  else settings[key] = value;
  return { ...doc, settings };
}

export function setEdgePresentation(
  doc: EditorDoc,
  edgeId: string,
  patch: EdgePresentation,
): EditorDoc {
  const merged: EdgePresentation = { ...(doc.edges[edgeId] ?? {}), ...patch };
  for (const k of Object.keys(merged) as Array<keyof EdgePresentation>)
    if (merged[k] === undefined) delete merged[k];
  const edges = { ...doc.edges };
  if (Object.keys(merged).length === 0) delete edges[edgeId];
  else edges[edgeId] = merged;
  return { ...doc, edges };
}

/**
 * The layout-file content to save. Only manual overrides are written; sizes are
 * written when they differ from the effective default. Overrides for nodes or
 * edges no longer in the diagram are dropped (the editor reports them first).
 */
export function toLayoutEdit(view: DiagramViewData, doc: EditorDoc): LayoutEdit {
  const settings = effectiveSettings(view, doc);
  const nodeIds = new Set(view.diagram.nodes.map((n) => n.id));
  const edgeIds = new Set(view.diagram.edges.map((e) => e.id));
  const nodes: Record<string, NodePlacement> = {};
  for (const id of doc.placed) {
    const box = doc.boxes[id];
    if (!box || !nodeIds.has(id)) continue;
    const p: NodePlacement = { x: box.x, y: box.y };
    if (box.width !== settings.nodeWidth || box.height !== settings.nodeHeight) {
      p.width = box.width;
      p.height = box.height;
    }
    nodes[id] = p;
  }
  const edges: Record<string, EdgePresentation> = {};
  for (const [id, e] of Object.entries(doc.edges)) if (edgeIds.has(id)) edges[id] = { ...e };
  return { settings: { ...doc.settings }, nodes, edges };
}

/** Canonical JSON of a document, for change detection. */
export function docKey(doc: EditorDoc): string {
  const sortObj = (o: Record<string, unknown>) =>
    Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, o[k]]),
    );
  return JSON.stringify([
    sortObj(doc.boxes),
    doc.placed,
    sortObj(doc.settings),
    sortObj(doc.edges),
  ]);
}

export function sameDoc(a: EditorDoc, b: EditorDoc): boolean {
  return a === b || docKey(a) === docKey(b);
}

/**
 * Rebase local edits onto a newly loaded view after an external change
 * (RELI-01..04 in the editor). Nodes the user placed keep their local boxes if
 * they still exist; everything else comes from the new view. Settings and edge
 * overrides the user changed are kept.
 */
export function rebaseDoc(
  previousBase: EditorDoc,
  local: EditorDoc,
  nextView: DiagramViewData,
): EditorDoc {
  const next = docFromView(nextView);
  const changedPlaced = local.placed.filter((id) => {
    const a = local.boxes[id];
    const b = previousBase.boxes[id];
    return (
      !previousBase.placed.includes(id) ||
      !a ||
      !b ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.width !== b.width ||
      a.height !== b.height
    );
  });
  const boxes = { ...next.boxes };
  const placed = new Set(next.placed);
  for (const id of changedPlaced) {
    if (!boxes[id] || !local.boxes[id]) continue;
    boxes[id] = { ...local.boxes[id]! };
    placed.add(id);
  }
  const settings = { ...next.settings };
  for (const key of Object.keys({ ...previousBase.settings, ...local.settings }) as Array<
    keyof LayoutSettings
  >) {
    if (previousBase.settings[key] !== local.settings[key]) {
      if (local.settings[key] === undefined) delete settings[key];
      else (settings as Record<string, unknown>)[key] = local.settings[key];
    }
  }
  const edges = { ...next.edges };
  for (const id of new Set([...Object.keys(previousBase.edges), ...Object.keys(local.edges)])) {
    if (JSON.stringify(previousBase.edges[id]) !== JSON.stringify(local.edges[id])) {
      if (local.edges[id] === undefined) delete edges[id];
      else edges[id] = { ...local.edges[id] };
    }
  }
  return { boxes, placed: sorted(placed), settings, edges };
}
