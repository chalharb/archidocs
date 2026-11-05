/**
 * Workspace snapshot state machine (RELI-02, RELI-03, RELI-04). Pure.
 *
 * - A load without error diagnostics becomes the active model ("valid").
 * - A failing load after a valid one keeps the last valid model and marks it
 *   "stale", exposing the new diagnostics so the user can fix the files.
 * - A failing load with no prior valid model exposes the best-effort model as "invalid".
 */
import { hasErrors, type Diagnostic } from "@/domain/diagnostics";
import { buildGraphIndex, type GraphIndex } from "@/domain/graph-index";
import type { ArchitectureModel } from "@/domain/model";
import type { FileInfo, WorkspaceLoad } from "./loader";

export type ModelStatus = "valid" | "invalid" | "stale";

export interface WorkspaceSnapshot {
  status: ModelStatus;
  /** Increments whenever anything visible changes. */
  version: number;
  model: ArchitectureModel;
  index: GraphIndex;
  /** Files behind `model` (for a stale snapshot, the last valid load's files). */
  files: Record<string, FileInfo>;
  /** Diagnostics of the most recent load attempt. */
  diagnostics: Diagnostic[];
  /** When `model` was loaded. */
  loadedAt: string;
  /** When the most recent load attempt ran. */
  checkedAt: string;
}

function fingerprint(s: Pick<WorkspaceSnapshot, "status" | "files" | "diagnostics">): string {
  return JSON.stringify([s.status, s.files, s.diagnostics]);
}

export function applyLoad(
  previous: WorkspaceSnapshot | null,
  load: WorkspaceLoad,
): { snapshot: WorkspaceSnapshot; changed: boolean } {
  const failed = hasErrors(load.diagnostics);
  const keepPrevious = failed && previous !== null && previous.status !== "invalid";

  const next: Omit<WorkspaceSnapshot, "version"> = keepPrevious
    ? {
        status: "stale",
        model: previous.model,
        index: previous.index,
        files: previous.files,
        diagnostics: load.diagnostics,
        loadedAt: previous.loadedAt,
        checkedAt: load.loadedAt,
      }
    : {
        status: failed ? "invalid" : "valid",
        model: load.model,
        index: buildGraphIndex(load.model),
        files: load.files,
        diagnostics: load.diagnostics,
        loadedAt: load.loadedAt,
        checkedAt: load.loadedAt,
      };

  if (previous && fingerprint(previous) === fingerprint(next)) {
    return { snapshot: { ...previous, checkedAt: next.checkedAt }, changed: false };
  }
  return { snapshot: { ...next, version: (previous?.version ?? 0) + 1 }, changed: true };
}
