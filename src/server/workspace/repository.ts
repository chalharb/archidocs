/**
 * WorkspaceRepository: the server-side service for one workspace root (SEC-09).
 *
 * All reads and writes for a workspace go through here. Operations are
 * serialized, so a reload never interleaves with a save.
 */
import { diagnostic, sortDiagnostics, type Diagnostic } from "@/domain/diagnostics";
import { resolveDiagram, type ResolvedDiagram } from "@/domain/diagram-resolve";
import { lookup } from "@/domain/graph-index";
import { elkPositionGenerator } from "@/domain/layout/elk";
import {
  resolveLayoutAsync,
  type AsyncPositionGenerator,
  type PositionGenerator,
  type ResolvedLayout,
} from "@/domain/layout/positions";
import { resolveLayoutSettings, type ResolvedSettings } from "@/domain/layout/settings";
import { sourceKey, type CanonicalEntity, type CanonicalRelationship } from "@/domain/model";
import { WorkspaceRoot } from "../fs/workspace-root";
import type { AtomicWriteOps } from "../fs/atomic-write";
import { assessDraft, DraftStore, type DraftState, type LayoutDraft } from "../persistence/drafts";
import {
  layoutTarget,
  LayoutSaveError,
  writeLayout,
  type LayoutEdit,
} from "../persistence/layout-writer";
import type { Revision } from "../persistence/revision";
import { DEFAULT_LOAD_OPTIONS, loadWorkspace, type LoadOptions } from "./loader";
import { applyLoad, type ModelStatus, type WorkspaceSnapshot } from "./snapshot";
import { watchWorkspace, type WorkspaceWatcher } from "./watcher";

export interface RepositoryOptions {
  load?: LoadOptions;
  now?: () => Date;
  writeOps?: AtomicWriteOps;
  /** Overrides the ELK.js generator for nodes without saved positions. */
  generator?: PositionGenerator | AsyncPositionGenerator;
  watch?: { debounceMs?: number; usePolling?: boolean };
}

export interface DiagramView {
  modelStatus: ModelStatus;
  diagram: ResolvedDiagram;
  settings: ResolvedSettings;
  layout: Omit<ResolvedLayout, "diagnostics">;
  /** Overrides currently saved in the layout file, as the editor's starting point. */
  saved: LayoutEdit;
  diagnostics: Diagnostic[];
  /** RELI-10: saved layout file vs autosaved draft (unsaved editor state lives in the client). */
  persistence: {
    layoutFile: string;
    writable: boolean;
    notWritableReason?: string;
    revision: Revision | null;
    draft: DraftState | null;
  };
}

export interface EntityView {
  entity: CanonicalEntity;
  parent?: string;
  children: readonly string[];
  outgoing: CanonicalRelationship[];
  incoming: CanonicalRelationship[];
  diagrams: readonly string[];
}

export type ChangeListener = (snapshot: WorkspaceSnapshot) => void;

export class WorkspaceRepository {
  private current: WorkspaceSnapshot | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private watcher: WorkspaceWatcher | null = null;
  private readonly listeners = new Set<ChangeListener>();
  private readonly drafts: DraftStore;
  private readonly loadOptions: LoadOptions;
  private readonly now: () => Date;

  private constructor(
    readonly key: string,
    readonly root: WorkspaceRoot,
    private readonly options: RepositoryOptions,
  ) {
    this.loadOptions = options.load ?? DEFAULT_LOAD_OPTIONS;
    this.now = options.now ?? (() => new Date());
    this.drafts = new DraftStore(root, this.loadOptions.parseLimits.maxBytes, this.now);
  }

  static async open(
    key: string,
    rootPath: string,
    options: RepositoryOptions = {},
  ): Promise<WorkspaceRepository> {
    const root = await WorkspaceRoot.open(rootPath, options.writeOps);
    const repo = new WorkspaceRepository(key, root, options);
    await repo.reload();
    return repo;
  }

  /** Run `fn` after every previously queued operation. */
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  snapshot(): WorkspaceSnapshot {
    return this.current!;
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-read the workspace (RELI-14). Never throws for bad workspace content. */
  reload(): Promise<{ snapshot: WorkspaceSnapshot; changed: boolean }> {
    return this.serialize(async () => {
      const load = await loadWorkspace(this.root, this.loadOptions, this.now);
      const result = applyLoad(this.current, load);
      this.current = result.snapshot;
      if (result.changed) for (const l of this.listeners) l(result.snapshot);
      return result;
    });
  }

  entityView(entityId: string): EntityView | null {
    const { model, index } = this.snapshot();
    const entity = model.entities[entityId];
    if (!entity) return null;
    const rels = (ids: readonly string[]) => ids.map((id) => model.relationships[id]!);
    const parent = lookup.parent(index, entityId);
    return {
      entity,
      ...(parent !== undefined ? { parent } : {}),
      children: lookup.children(index, entityId),
      outgoing: rels(lookup.outgoing(index, entityId)),
      incoming: rels(lookup.incoming(index, entityId)),
      diagrams: lookup.diagramsForEntity(index, entityId),
    };
  }

  async diagramView(diagramId: string): Promise<DiagramView | null> {
    const snap = this.snapshot();
    const { model } = snap;
    const resolved = resolveDiagram(model, diagramId);
    if (!resolved.diagram) return null;
    const def = model.diagrams[diagramId]!;
    const saved = model.layouts[diagramId];
    const settings = resolveLayoutSettings({
      workspace: model.workspace?.layoutDefaults,
      diagram: def.layout,
      layout: saved?.settings,
    });
    const { diagnostics: layoutDiagnostics, ...layout } = await resolveLayoutAsync({
      diagram: resolved.diagram,
      ...(saved ? { layout: saved } : {}),
      settings: settings.settings,
      generator: this.options.generator ?? elkPositionGenerator(resolved.diagram),
    });
    const target = layoutTarget(model, diagramId)!;
    const revision = snap.files[target.path]?.revision ?? null;
    const layoutSource = model.sources[sourceKey("layout", diagramId)];
    const fileDiagnostics = snap.diagnostics.filter(
      (d) => d.code.startsWith("LAYOUT_") && layoutSource && d.file === layoutSource.file,
    );
    const loaded = await this.drafts.load(diagramId);
    return {
      modelStatus: snap.status,
      diagram: resolved.diagram,
      settings,
      layout,
      saved: {
        settings: { ...(saved?.settings ?? {}) },
        nodes: { ...(saved?.nodes ?? {}) },
        edges: { ...(saved?.edges ?? {}) },
      },
      diagnostics: sortDiagnostics([
        ...resolved.diagnostics,
        ...fileDiagnostics,
        ...layoutDiagnostics.map((d) => ({ ...d, file: target.path })),
      ]),
      persistence: {
        layoutFile: target.path,
        writable: target.writable,
        ...(target.reason ? { notWritableReason: target.reason } : {}),
        revision,
        draft: loaded ? assessDraft(loaded, revision, def) : null,
      },
    };
  }

  /**
   * Save layout overrides (P0-12). On a write failure the edit is kept as a
   * draft so it can be recovered (FAIL-02); on success any draft is discarded.
   */
  saveLayout(
    diagramId: string,
    edit: LayoutEdit,
    baseRevision: Revision | null,
  ): Promise<{ path: string; revision: Revision; snapshot: WorkspaceSnapshot }> {
    return this.serialize(async () => {
      const model = this.snapshot().model;
      let written;
      try {
        written = await writeLayout({
          root: this.root,
          model,
          diagramId,
          edit,
          baseRevision,
          maxBytes: this.loadOptions.parseLimits.maxBytes,
        });
      } catch (err) {
        if (err instanceof LayoutSaveError && err.code === "WRITE_FAILED") {
          await this.drafts.save(diagramId, baseRevision, edit).catch(() => undefined);
        }
        throw err;
      }
      await this.drafts.discard(diagramId).catch(() => undefined);
      const load = await loadWorkspace(this.root, this.loadOptions, this.now);
      const result = applyLoad(this.current, load);
      this.current = result.snapshot;
      if (result.changed) for (const l of this.listeners) l(result.snapshot);
      return { path: written.path, revision: written.revision, snapshot: result.snapshot };
    });
  }

  saveDraft(
    diagramId: string,
    edit: LayoutEdit,
    baseRevision: Revision | null,
  ): Promise<LayoutDraft> {
    return this.serialize(async () => {
      if (!this.snapshot().model.diagrams[diagramId]) {
        throw new LayoutSaveError("DIAGRAM_NOT_FOUND", `Unknown diagram '${diagramId}'`);
      }
      return this.drafts.save(diagramId, baseRevision, edit);
    });
  }

  discardDraft(diagramId: string): Promise<void> {
    return this.serialize(() => this.drafts.discard(diagramId));
  }

  /** Start reacting to external file changes (RELI-01..04). */
  async startWatching(): Promise<void> {
    if (this.watcher) return;
    this.watcher = watchWorkspace(this.root.realPath, () => void this.reload(), this.options.watch);
    await this.watcher.ready;
    // Close the startup race: pick up anything that changed before the watcher was live.
    await this.reload();
  }

  async close(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
    await this.queue;
  }
}

/** Diagnostics describing why the model shown is stale (DIAG-10 support). */
export function staleNotice(snapshot: WorkspaceSnapshot): Diagnostic | null {
  if (snapshot.status !== "stale") return null;
  return diagnostic(
    "warning",
    "MODEL_STALE",
    `Showing the last valid model from ${snapshot.loadedAt}; the latest files have errors`,
    { hint: "Fix the errors below; the model refreshes automatically once the files are valid." },
  );
}
