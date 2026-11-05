/**
 * Read models for documentation pages (DOC-05, DOC-06, ADR-04, ADR-05, ADD-009).
 * Pure functions of a workspace snapshot.
 */
import { sortDiagnostics, type Diagnostic } from "@/domain/diagnostics";
import { resolveDocLink, type ResolvedLink } from "@/domain/documentation";
import { lookup } from "@/domain/graph-index";
import {
  sourceKey,
  type ArchitectureModel,
  type CanonicalDecision,
  type CanonicalDocument,
} from "@/domain/model";
import { compareCodePoints } from "@/domain/order";
import type { DecisionStatus } from "@/domain/resources";
import type { ModelStatus, WorkspaceSnapshot } from "./snapshot";

export interface DocumentSummary {
  id: string;
  title: string;
  description?: string;
  tags: string[];
}

export interface DecisionSummary {
  id: string;
  title: string;
  status: DecisionStatus;
  date: string;
  tags: string[];
  entities: string[];
}

/** Where a body link goes in the app; `diagram` is set for entity links shown in a diagram. */
export interface LinkTarget extends ResolvedLink {
  title: string;
  diagram?: string;
}

export interface NamedRef {
  id: string;
  title: string;
}

interface PageViewBase {
  modelStatus: ModelStatus;
  file: string;
  /** Diagnostics reported for this file. */
  diagnostics: Diagnostic[];
  /** Body link URLs to their targets; null for broken links (DOC-04). */
  links: Record<string, LinkTarget | null>;
  entities: NamedRef[];
  diagrams: NamedRef[];
}

export interface DocumentPageView extends PageViewBase {
  document: CanonicalDocument;
}

export interface DecisionPageView extends PageViewBase {
  decision: CanonicalDecision;
  supersedes: NamedRef[];
  supersededBy: NamedRef[];
}

export interface DocumentationRefs {
  documents: DocumentSummary[];
  decisions: DecisionSummary[];
}

export function documentSummary(d: CanonicalDocument): DocumentSummary {
  return {
    id: d.id,
    title: d.title,
    ...(d.description !== undefined ? { description: d.description } : {}),
    tags: d.tags,
  };
}

export function decisionSummary(d: CanonicalDecision): DecisionSummary {
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    date: d.date,
    tags: d.tags,
    entities: d.entities,
  };
}

/** Newest first, then by ID (ADR-04). */
export function compareDecisions(a: DecisionSummary, b: DecisionSummary): number {
  return compareCodePoints(b.date, a.date) || compareCodePoints(a.id, b.id);
}

export function documentList(model: ArchitectureModel): DocumentSummary[] {
  return Object.values(model.documents)
    .map(documentSummary)
    .sort(
      (a, b) =>
        compareCodePoints(a.title.toLowerCase(), b.title.toLowerCase()) ||
        compareCodePoints(a.id, b.id),
    );
}

export function decisionList(model: ArchitectureModel): DecisionSummary[] {
  return Object.values(model.decisions).map(decisionSummary).sort(compareDecisions);
}

function linkTargets(
  snap: WorkspaceSnapshot,
  item: CanonicalDocument | CanonicalDecision,
): Record<string, LinkTarget | null> {
  const { model, index } = snap;
  const out: Record<string, LinkTarget | null> = {};
  for (const link of item.links) {
    if (link.url in out) continue;
    const target = resolveDocLink(model, link);
    if (!target) {
      out[link.url] = null;
      continue;
    }
    const title =
      target.kind === "entity"
        ? model.entities[target.id]!.name
        : target.kind === "diagram"
          ? model.diagrams[target.id]!.name
          : target.kind === "decision"
            ? model.decisions[target.id]!.title
            : model.documents[target.id]!.title;
    const diagram =
      target.kind === "entity" ? lookup.diagramsForEntity(index, target.id)[0] : undefined;
    out[link.url] = { ...target, title, ...(diagram !== undefined ? { diagram } : {}) };
  }
  return out;
}

function base(
  snap: WorkspaceSnapshot,
  category: "document" | "decision",
  item: CanonicalDocument | CanonicalDecision,
): PageViewBase {
  const { model } = snap;
  const file = model.sources[sourceKey(category, item.id)]!.file;
  return {
    modelStatus: snap.status,
    file,
    diagnostics: sortDiagnostics(snap.diagnostics.filter((d) => d.file === file)),
    links: linkTargets(snap, item),
    entities: item.entities
      .filter((id) => model.entities[id])
      .map((id) => ({ id, title: model.entities[id]!.name })),
    diagrams: item.diagrams
      .filter((id) => model.diagrams[id])
      .map((id) => ({ id, title: model.diagrams[id]!.name })),
  };
}

export function documentPage(snap: WorkspaceSnapshot, id: string): DocumentPageView | null {
  const document = snap.model.documents[id];
  return document ? { ...base(snap, "document", document), document } : null;
}

export function decisionPage(snap: WorkspaceSnapshot, id: string): DecisionPageView | null {
  const { model, index } = snap;
  const decision = model.decisions[id];
  if (!decision) return null;
  const named = (ids: readonly string[]) =>
    ids.filter((d) => model.decisions[d]).map((d) => ({ id: d, title: model.decisions[d]!.title }));
  return {
    ...base(snap, "decision", decision),
    decision,
    supersedes: named([...new Set(decision.supersedes)]),
    supersededBy: named(lookup.supersededBy(index, id)),
  };
}

/** Documents and decisions that reference an entity (DOC-05). */
export function entityDocumentation(snap: WorkspaceSnapshot, entityId: string): DocumentationRefs {
  const { model, index } = snap;
  return {
    documents: lookup
      .documentsForEntity(index, entityId)
      .map((id) => documentSummary(model.documents[id]!)),
    decisions: lookup
      .decisionsForEntity(index, entityId)
      .map((id) => decisionSummary(model.decisions[id]!))
      .sort(compareDecisions),
  };
}

/** Documents and decisions that reference a diagram (DOC-05). */
export function diagramDocumentation(
  snap: WorkspaceSnapshot,
  diagramId: string,
): DocumentationRefs {
  const { model, index } = snap;
  return {
    documents: lookup
      .documentsForDiagram(index, diagramId)
      .map((id) => documentSummary(model.documents[id]!)),
    decisions: lookup
      .decisionsForDiagram(index, diagramId)
      .map((id) => decisionSummary(model.decisions[id]!))
      .sort(compareDecisions),
  };
}
