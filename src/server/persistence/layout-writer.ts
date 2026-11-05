/**
 * Safe layout persistence (P0-12).
 *
 * 1. Validate the proposed layout before anything touches disk (RELI-09).
 * 2. Write only the diagram's own `.layout.yaml`; never a file that holds other
 *    resources (LAYOUT-22, LAYOUT-23).
 * 3. Compare the caller's base revision with the file currently on disk and
 *    refuse to overwrite external changes (RELI-06, RELI-07).
 * 4. Replace atomically; on failure the previous file is untouched (RELI-08, RELI-12).
 */
import path from "node:path";
import { formatPath } from "@/domain/diagnostics";
import { serializeLayout, parseLayoutFile, LAYOUT_FILE_SUFFIX } from "@/domain/layout/serialize";
import type { ArchitectureModel, CanonicalDiagramLayout } from "@/domain/model";
import { sourceKey } from "@/domain/model";
import { diagramLayoutSchema } from "@/domain/schema/resource-schemas";
import type { EdgePresentation, LayoutSettingsOverrides, NodePlacement } from "@/domain/resources";
import { FsError } from "../fs/errors";
import type { WorkspaceRoot } from "../fs/workspace-root";
import { revisionOf, type Revision } from "./revision";

export interface LayoutEdit {
  settings?: LayoutSettingsOverrides;
  nodes?: Record<string, NodePlacement>;
  edges?: Record<string, EdgePresentation>;
}

export type LayoutSaveErrorCode =
  "DIAGRAM_NOT_FOUND" | "INVALID" | "NOT_WRITABLE" | "CONFLICT" | "WRITE_FAILED";

export class LayoutSaveError extends Error {
  constructor(
    readonly code: LayoutSaveErrorCode,
    message: string,
    readonly details: { issues?: string[]; currentRevision?: Revision | null; path?: string } = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LayoutSaveError";
  }
}

export interface LayoutTarget {
  path: string;
  writable: boolean;
  reason?: string;
}

/** Where the layout for `diagramId` lives (or will live), and whether we may write it. */
export function layoutTarget(model: ArchitectureModel, diagramId: string): LayoutTarget | null {
  const diagramSource = model.sources[sourceKey("diagram", diagramId)];
  if (!diagramSource) return null;
  const ownKey = sourceKey("layout", diagramId);
  const existing = model.sources[ownKey];
  const file =
    existing?.file ??
    path.posix.join(path.posix.dirname(diagramSource.file), `${diagramId}${LAYOUT_FILE_SUFFIX}`);
  const shared = Object.entries(model.sources).some(
    ([key, src]) => key !== ownKey && src.file === file,
  );
  if (shared) {
    return {
      path: file,
      writable: false,
      reason: `'${file}' also contains other resources; move the DiagramLayout into its own file to save layouts`,
    };
  }
  return { path: file, writable: true };
}

/** Build and validate the layout that would be written (RELI-09). Pure. */
export function prepareLayout(
  model: ArchitectureModel,
  diagramId: string,
  edit: LayoutEdit,
): { layout: CanonicalDiagramLayout; content: string } {
  const diagram = model.diagrams[diagramId];
  if (!diagram) throw new LayoutSaveError("DIAGRAM_NOT_FOUND", `Unknown diagram '${diagramId}'`);

  const candidate = {
    apiVersion: "archdocs/v1",
    kind: "DiagramLayout",
    diagram: diagramId,
    ...(edit.settings ? { settings: edit.settings } : {}),
    ...(edit.nodes ? { nodes: edit.nodes } : {}),
    ...(edit.edges ? { edges: edit.edges } : {}),
  };
  const parsed = diagramLayoutSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new LayoutSaveError("INVALID", "Layout is invalid", {
      issues: parsed.error.issues.map(
        (i) => `${formatPath(i.path as Array<string | number>) || "(root)"}: ${i.message}`,
      ),
    });
  }
  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const edgeIds = new Set(diagram.edges.map((e) => e.id));
  const issues = [
    ...Object.keys(parsed.data.nodes ?? {})
      .filter((id) => !nodeIds.has(id))
      .map((id) => `nodes.${id}: not a node in diagram '${diagramId}'`),
    ...Object.keys(parsed.data.edges ?? {})
      .filter((id) => !edgeIds.has(id))
      .map((id) => `edges.${id}: not an edge in diagram '${diagramId}'`),
  ];
  if (issues.length > 0)
    throw new LayoutSaveError("INVALID", "Layout references unknown nodes or edges", { issues });

  const layout: CanonicalDiagramLayout = {
    diagram: diagramId,
    settings: parsed.data.settings ?? {},
    nodes: parsed.data.nodes ?? {},
    edges: parsed.data.edges ?? {},
  };
  const content = serializeLayout(layout);
  // Belt and braces: what we write must parse back cleanly and identically.
  const reparsed = parseLayoutFile(content, "(pending)");
  /* v8 ignore next 3 -- guards against serializer bugs; unreachable when serializer is correct */
  if (reparsed.diagnostics.length > 0 || serializeLayout(reparsed.layout!) !== content) {
    throw new LayoutSaveError("INVALID", "Serialized layout failed round-trip validation");
  }
  return { layout, content };
}

export async function writeLayout(input: {
  root: WorkspaceRoot;
  model: ArchitectureModel;
  diagramId: string;
  edit: LayoutEdit;
  /** Revision the caller's edit is based on; null when the file did not exist. */
  baseRevision: Revision | null;
  maxBytes: number;
}): Promise<{ path: string; revision: Revision; content: string }> {
  const { root, model, diagramId, edit, baseRevision, maxBytes } = input;
  const { content } = prepareLayout(model, diagramId, edit);
  const target = layoutTarget(model, diagramId)!;
  if (!target.writable)
    throw new LayoutSaveError("NOT_WRITABLE", target.reason!, { path: target.path });

  let current: string | null;
  try {
    current = await root.readFileIfExists(target.path, maxBytes);
  } catch (err) {
    throw new LayoutSaveError(
      "WRITE_FAILED",
      `Cannot read current layout: ${(err as Error).message}`,
      { path: target.path },
      { cause: err },
    );
  }
  const currentRevision = current === null ? null : revisionOf(current);
  if (currentRevision !== baseRevision) {
    throw new LayoutSaveError(
      "CONFLICT",
      current === null
        ? `'${target.path}' was deleted after you loaded it`
        : `'${target.path}' was changed outside the editor; reload and resolve before saving`,
      { currentRevision, path: target.path },
    );
  }
  try {
    await root.writeFileAtomic(target.path, content);
  } catch (err) {
    const reason = err instanceof FsError ? err.code : "IO_ERROR";
    throw new LayoutSaveError(
      "WRITE_FAILED",
      `Saving '${target.path}' failed (${reason}); the previous file is unchanged`,
      { path: target.path },
      { cause: err },
    );
  }
  return { path: target.path, revision: revisionOf(content), content };
}
