/**
 * Documentation validation and link resolution (DOC-03, DOC-04, ADR-02, ADR-03, ADD-009).
 *
 * Broken references are warnings so documentation never blocks a model reload.
 * Only supersession cycles are errors. Pure and deterministic.
 */
import { diagnostic, type Diagnostic, type DiagnosticCode, type Severity } from "./diagnostics";
import type { DocLink, ModelLinkKind } from "./markdown";
import {
  sourceKey,
  type ArchitectureModel,
  type CanonicalDecision,
  type CanonicalDocument,
} from "./model";
import { compareCodePoints } from "./order";

export const ADR_SECTIONS = ["Context", "Decision", "Consequences"] as const;

export interface ResolvedLink {
  kind: ModelLinkKind;
  id: string;
}

/** Where a document link points in the model, or null if it's broken. */
export function resolveDocLink(model: ArchitectureModel, link: DocLink): ResolvedLink | null {
  const { kind, target } = link;
  if (target === null) return null;
  switch (kind) {
    case "entity":
      return model.entities[target] ? { kind, id: target } : null;
    case "diagram":
      return model.diagrams[target] ? { kind, id: target } : null;
    case "decision":
      return model.decisions[target] ? { kind, id: target } : null;
    case "document":
      return model.documents[target] ? { kind, id: target } : null;
    case "file":
      for (const category of ["document", "decision"] as const) {
        const items = category === "document" ? model.documents : model.decisions;
        for (const id of Object.keys(items))
          if (model.sources[sourceKey(category, id)]!.file === target)
            return { kind: category, id };
      }
      return null;
  }
}

/** Decisions that supersede each decision (ADR-03), sorted. */
export function supersededBy(model: ArchitectureModel): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of Object.values(model.decisions))
    for (const target of new Set(d.supersedes))
      if (model.decisions[target]) (out[target] ??= []).push(d.id);
  for (const ids of Object.values(out)) ids.sort(compareCodePoints);
  return out;
}

/** Decision IDs that lie on a supersession cycle, grouped by cycle (strongly connected component). */
export function supersessionCycles(model: ArchitectureModel): string[][] {
  const ids = Object.keys(model.decisions).sort(compareCodePoints);
  const next = (id: string) =>
    [...new Set(model.decisions[id]!.supersedes)]
      .filter((t) => model.decisions[t])
      .sort(compareCodePoints);
  // Tarjan's algorithm, iterative so long chains can't overflow the stack.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;
  for (const root of ids) {
    if (index.has(root)) continue;
    const work: Array<{ id: string; edges: string[]; i: number }> = [];
    const open = (id: string) => {
      index.set(id, counter);
      low.set(id, counter++);
      stack.push(id);
      onStack.add(id);
      work.push({ id, edges: next(id), i: 0 });
    };
    open(root);
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      if (frame.i < frame.edges.length) {
        const to = frame.edges[frame.i++]!;
        if (!index.has(to)) open(to);
        else if (onStack.has(to)) low.set(frame.id, Math.min(low.get(frame.id)!, index.get(to)!));
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.id, Math.min(low.get(parent.id)!, low.get(frame.id)!));
      if (low.get(frame.id) === index.get(frame.id)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.id);
        const selfLoop = component.length === 1 && frame.edges.includes(frame.id);
        if (component.length > 1 || selfLoop) cycles.push(component.sort(compareCodePoints));
      }
    }
  }
  return cycles.sort((a, b) => compareCodePoints(a[0]!, b[0]!));
}

export function validateDocumentation(model: ArchitectureModel): Diagnostic[] {
  const out: Diagnostic[] = [];
  const at = (
    severity: Severity,
    code: DiagnosticCode,
    category: "document" | "decision",
    id: string,
    where: { path?: Array<string | number>; line?: number; column?: number },
    message: string,
    hint?: string,
  ) => {
    const src = model.sources[sourceKey(category, id)]!;
    out.push(
      diagnostic(severity, code, message, {
        file: src.file,
        document: src.document,
        ...where,
        hint,
      }),
    );
  };

  const items: Array<["document" | "decision", CanonicalDocument | CanonicalDecision]> = [
    ...Object.values(model.documents).map(
      (d) => ["document", d] as ["document", CanonicalDocument],
    ),
    ...Object.values(model.decisions).map(
      (d) => ["decision", d] as ["decision", CanonicalDecision],
    ),
  ];

  for (const [category, item] of items) {
    const label = `${category === "document" ? "Document" : "Decision"} '${item.id}'`;
    // DOC-03: front-matter traceability.
    item.entities.forEach((id, i) => {
      if (!model.entities[id])
        at(
          "warning",
          "DOC_REF_MISSING",
          category,
          item.id,
          { path: ["entities", i] },
          `${label} references unknown entity '${id}'`,
        );
    });
    item.diagrams.forEach((id, i) => {
      if (!model.diagrams[id])
        at(
          "warning",
          "DOC_REF_MISSING",
          category,
          item.id,
          { path: ["diagrams", i] },
          `${label} references unknown diagram '${id}'`,
        );
    });
    // DOC-04: inline links.
    for (const link of item.links) {
      if (resolveDocLink(model, link)) continue;
      const what =
        link.kind === "file"
          ? link.target === null
            ? `points outside the workspace`
            : `points to '${link.target}', which isn't a document or decision`
          : `points to unknown ${link.kind} '${link.target}'`;
      at(
        "warning",
        "DOC_LINK_BROKEN",
        category,
        item.id,
        { line: link.line, column: link.column },
        `Link '${link.url}' ${what}`,
        link.kind === "file"
          ? "Link to another document's .md file, or use document: and decision: links."
          : `Check the ${link.kind} ID; IDs are case-sensitive.`,
      );
    }
  }

  // --- Decisions ------------------------------------------------------------
  const successors = supersededBy(model);
  for (const d of Object.values(model.decisions)) {
    d.supersedes.forEach((id, i) => {
      if (!model.decisions[id])
        at(
          "warning",
          "DOC_REF_MISSING",
          "decision",
          d.id,
          { path: ["supersedes", i] },
          `Decision '${d.id}' supersedes unknown decision '${id}'`,
        );
    });
    // ADR-02: recommended sections.
    const headings = new Set(d.headings.map((h) => h.text.toLowerCase()));
    const missing = ADR_SECTIONS.filter((s) => !headings.has(s.toLowerCase()));
    if (missing.length > 0) {
      at(
        "warning",
        "ADR_SECTION_MISSING",
        "decision",
        d.id,
        { line: d.body.line },
        `Decision '${d.id}' has no ${missing.join(", ")} section${missing.length > 1 ? "s" : ""}`,
        `Add ${missing.map((s) => `'## ${s}'`).join(", ")} heading${missing.length > 1 ? "s" : ""}.`,
      );
    }
    // ADR-03: status agrees with supersession.
    const by = successors[d.id] ?? [];
    if (by.length > 0 && d.status !== "superseded") {
      at(
        "warning",
        "ADR_STATUS_MISMATCH",
        "decision",
        d.id,
        { path: ["status"] },
        `Decision '${d.id}' is superseded by ${by.map((id) => `'${id}'`).join(", ")} but its status is '${d.status}'`,
        "Set 'status: superseded'.",
      );
    } else if (by.length === 0 && d.status === "superseded") {
      at(
        "warning",
        "ADR_STATUS_MISMATCH",
        "decision",
        d.id,
        { path: ["status"] },
        `Decision '${d.id}' has status 'superseded', but no decision supersedes it`,
        "Add its ID to the 'supersedes' list of the decision that replaces it, or change its status.",
      );
    }
  }
  for (const cycle of supersessionCycles(model)) {
    for (const id of cycle) {
      at(
        "error",
        "ADR_SUPERSESSION_CYCLE",
        "decision",
        id,
        { path: ["supersedes"] },
        `Supersession cycle between decisions ${cycle.map((c) => `'${c}'`).join(", ")}`,
        "A decision can't directly or indirectly supersede itself. Remove one of the 'supersedes' entries.",
      );
    }
  }
  return out;
}
