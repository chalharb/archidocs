"use client";

/**
 * Diagram viewer and layout editor (Phase 1, DIAG-12).
 *
 * Renders a resolved diagram with React Flow in one of two modes (ADD-007):
 * - view: read-only canvas with inspection, export and a diagnostics indicator;
 * - edit: the layout editor, where the user can drag, align/distribute, snap,
 *   re-layout with ELK, change layout settings and edge presentation,
 *   undo/redo, and save to the diagram's `.layout.yaml`.
 * Both reload live on external changes. Entities and relationships can't be
 * created or deleted in either mode (SCOPE-01).
 */
import "@xyflow/react/dist/style.css";
import "./diagram.css";

import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DiagnosticsList } from "@/components/diagnostics-list";
import { layoutAll } from "@/domain/layout/elk";
import type { EdgePresentation, LayoutSettings } from "@/domain/resources";
import { toFlowEdges, toFlowNodes, type ArchFlowNode } from "@/editor/flow";
import type { AlignMode, DistributeAxis } from "@/editor/geometry";
import { canRedo, canUndo, createHistory, push, redo, undo, type History } from "@/editor/history";
import {
  alignNodes,
  applyRelayout,
  distributeNodes,
  docFromDraft,
  docFromView,
  edgeAnimatedOf,
  edgeTypeOf,
  effectiveSettings,
  moveNodes,
  rebaseDoc,
  resizeNode,
  sameDoc,
  sameEdit,
  setEdgePresentation,
  setSetting,
  toLayoutEdit,
  type EditorDoc,
} from "@/editor/state";
import type { DiagramView } from "@/server/workspace/repository";
import { api, isApiError, type ApiError } from "./api";
import { ArchEdge } from "./edges";
import { EditorCallbacks, type EditorCallbackValue } from "./editor-context";
import { downloadDataUrl, renderDiagramImage, type ExportFormat } from "./export";
import { EdgeInspector, NodeInspector, type DiagramLink } from "./inspector";
import { diagramHref, type DiagramMode } from "./links";
import { BoundaryNode, ElementNode } from "./nodes";
import { SettingsPanel } from "./settings-panel";
import { Toolbar } from "./toolbar";
import { ViewBar } from "./view-bar";

const nodeTypes = { element: ElementNode, boundary: BoundaryNode };
const edgeTypes = { arch: ArchEdge };
/** Shift, Ctrl or Cmd adds to the selection, on every platform. */
const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"];

export interface DiagramEditorProps {
  workspace: string;
  initialView: DiagramView;
  diagrams: readonly DiagramLink[];
  /** Entity to select on load (navigation from another diagram, DIAG-07). */
  focus?: string;
  /** Read-only view (default) or layout editor (DIAG-12). */
  mode?: DiagramMode;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; error: ApiError }
  | { kind: "conflict"; error: ApiError };

export const DRAFT_AUTOSAVE_MS = 1500;

export function DiagramEditor(props: DiagramEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({
  workspace,
  initialView,
  diagrams,
  focus,
  mode = "view",
}: DiagramEditorProps) {
  const rf = useReactFlow();
  const router = useRouter();
  const editing = mode === "edit";
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = initialView.diagram.id;

  const [view, setView] = useState(initialView);
  const [base, setBase] = useState<EditorDoc>(() => docFromView(initialView));
  const [history, setHistory] = useState<History<EditorDoc>>(() => createHistory(base));
  const doc = history.present;
  const focusIds = useMemo(
    () => new Set(initialView.diagram.nodes.filter((n) => n.entityId === focus).map((n) => n.id)),
    [initialView, focus],
  );
  const [nodes, setNodes] = useState<ArchFlowNode[]>(() =>
    toFlowNodes(initialView.diagram.nodes, base, { selected: focusIds }),
  );
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  /** Selection whose details panel the viewer closed; a new selection reopens it. */
  const [closedSelection, setClosedSelection] = useState<string | null>(null);
  const [confirmDone, setConfirmDone] = useState(false);

  const dirty = !sameEdit(view, base, doc);
  /** Revision of the layout file this editor last wrote, to tell our saves from external edits. */
  const savedRevision = useRef<string | null>(null);
  /** Layout changes are possible only in the editor, on a writable layout file. */
  const readOnly = !editing || !view.persistence.writable;
  const settings = effectiveSettings(view, doc);
  const selectedIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);

  /** Replace the history (and re-render nodes from its present document). */
  const commit = useCallback((next: History<EditorDoc>, nextView: DiagramView) => {
    setHistory(next);
    setNodes((prev) =>
      toFlowNodes(nextView.diagram.nodes, next.present, {
        selected: new Set(prev.filter((n) => n.selected).map((n) => n.id)),
      }),
    );
  }, []);

  const change = useCallback(
    (next: EditorDoc) => commit(push(history, next, sameDoc), view),
    [commit, history, view],
  );

  // Latest state for long-lived listeners (events, keyboard).
  const latest = useRef({ view, base, history, dirty });
  useEffect(() => {
    latest.current = { view, base, history, dirty };
  });

  // --- External changes (RELI-01..04) ---------------------------------------
  const refresh = useCallback(async () => {
    let fresh: DiagramView;
    try {
      fresh = await api.diagram(workspace, diagramId);
    } catch {
      setNotice("This diagram is no longer available in the workspace.");
      return;
    }
    const cur = latest.current;
    const freshDoc = docFromView(fresh);
    const layoutChanged =
      fresh.persistence.revision !== cur.view.persistence.revision &&
      fresh.persistence.revision !== savedRevision.current;
    const changedOnDisk =
      layoutChanged ||
      fresh.modelStatus !== cur.view.modelStatus ||
      JSON.stringify(fresh.diagram) !== JSON.stringify(cur.view.diagram);
    setView(fresh);
    setBase(freshDoc);
    if (!cur.dirty) {
      // Keep undo history unless the saved layout itself changed underneath us.
      const keep = sameEdit(fresh, freshDoc, cur.history.present);
      commit(keep ? { ...cur.history, present: freshDoc } : createHistory(freshDoc), fresh);
      if (changedOnDisk) setNotice("The diagram was reloaded because its files changed on disk.");
    } else {
      // Keep undo history: undoing steps back through the local edits.
      commit(push(cur.history, rebaseDoc(cur.base, cur.history.present, fresh), sameDoc), fresh);
      if (changedOnDisk)
        setNotice("Files changed on disk. Your unsaved layout changes were kept on top of them.");
    }
  }, [commit, diagramId, workspace]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(api.eventsUrl(workspace));
    let first = true;
    source.addEventListener("change", () => {
      if (first) {
        first = false;
        return;
      }
      void refresh();
    });
    return () => source.close();
  }, [workspace, refresh]);

  // --- Drafts (RELI-11) -----------------------------------------------------
  useEffect(() => {
    if (!dirty || readOnly) return;
    const timer = setTimeout(() => {
      void api
        .saveDraft(workspace, diagramId, view.persistence.revision, toLayoutEdit(view, doc))
        .catch(() => undefined);
    }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, readOnly, doc, view, workspace, diagramId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // --- Operations -------------------------------------------------------------
  const onNodesChange = useCallback((changes: NodeChange<ArchFlowNode>[]) => {
    // Removal is never allowed (SCOPE-01).
    const allowed = changes.filter((c) => c.type !== "remove" && c.type !== "add");
    setNodes((nds) => applyNodeChanges(allowed, nds));
  }, []);

  const absoluteOf = useCallback(
    (n: ArchFlowNode, moved: Record<string, { x: number; y: number }>) => {
      const parent = n.parentId;
      if (!parent) return { x: n.position.x, y: n.position.y };
      const p = moved[parent] ?? doc.boxes[parent] ?? { x: 0, y: 0 };
      return { x: p.x + n.position.x, y: p.y + n.position.y };
    },
    [doc.boxes],
  );

  const onNodeDragStop = useCallback(
    (_e: unknown, _node: ArchFlowNode, dragged: ArchFlowNode[]) => {
      const moves: Record<string, { x: number; y: number }> = {};
      const byDepth = [...dragged].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
      for (const n of byDepth) moves[n.id] = absoluteOf(n, moves);
      change(moveNodes(doc, view.diagram, moves));
    },
    [absoluteOf, change, doc, view.diagram],
  );

  const onResized = useCallback(
    (id: string, box: { x: number; y: number; width: number; height: number }) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const abs = absoluteOf({ ...node, position: { x: box.x, y: box.y } }, {});
      change(resizeNode(doc, id, { ...abs, width: box.width, height: box.height }));
    },
    [absoluteOf, change, doc, nodes],
  );

  const callbacks = useMemo<EditorCallbackValue>(
    () => ({ readOnly, staticEdges: exporting, onResized }),
    [readOnly, exporting, onResized],
  );

  /** Edges are derived from the document; only selection changes apply (SCOPE-01). */
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type !== "select") continue;
      setSelectedEdge((current) => (c.selected ? c.id : current === c.id ? null : current));
    }
  }, []);

  const onAlign = (mode: AlignMode) => change(alignNodes(doc, view.diagram, selectedIds, mode));
  const onDistribute = (axis: DistributeAxis) =>
    change(distributeNodes(doc, view.diagram, selectedIds, axis));

  const onRelayout = async () => {
    setBusy(true);
    try {
      const out = await layoutAll({
        nodes: view.diagram.nodes,
        edges: view.diagram.edges,
        settings,
      });
      change(applyRelayout(doc, out));
      requestAnimationFrame(() => void rf.fitView({ padding: 0.1 }));
    } finally {
      setBusy(false);
    }
  };

  const onSetting = <K extends keyof LayoutSettings>(
    key: K,
    value: LayoutSettings[K] | undefined,
  ) => change(setSetting(doc, key, value));

  const onEdgeChange = (patch: EdgePresentation) => {
    if (selectedEdge) change(setEdgePresentation(doc, selectedEdge, patch));
  };

  const onUndo = useCallback(
    () => commit(undo(latest.current.history), latest.current.view),
    [commit],
  );
  const onRedo = useCallback(
    () => commit(redo(latest.current.history), latest.current.view),
    [commit],
  );
  const onRevert = () => commit(push(history, base, sameDoc), view);

  /** Save the layout; resolves to whether the file now matches the editor. */
  const onSave = useCallback(async (): Promise<boolean> => {
    const { view: v, history: h, dirty: d } = latest.current;
    if (!d) return true;
    if (!editing || !v.persistence.writable) return false;
    setSave({ kind: "saving" });
    try {
      const result = await api.saveLayout(
        workspace,
        diagramId,
        v.persistence.revision,
        toLayoutEdit(v, h.present),
      );
      savedRevision.current = result.revision;
      const fresh = await api.diagram(workspace, diagramId);
      setView(fresh);
      setBase(h.present);
      setNotice(null);
      setSave({ kind: "idle" });
      return true;
    } catch (e) {
      const error: ApiError = isApiError(e)
        ? e
        : { status: 0, code: "NETWORK", message: "The server could not be reached." };
      setSave({ kind: error.code === "CONFLICT" ? "conflict" : "error", error });
      return false;
    }
  }, [diagramId, editing, workspace]);

  // --- Leaving the editor (ADD-007) -------------------------------------------
  const viewHref = diagramHref(workspace, diagramId, "view");
  const onDone = () => (dirty ? setConfirmDone(true) : router.push(viewHref));
  const onSaveAndClose = async () => {
    if (await onSave()) router.push(viewHref);
    else setConfirmDone(false);
  };
  const onDiscardAndClose = () => {
    void api.discardDraft(workspace, diagramId).catch(() => undefined);
    commit(push(history, base, sameDoc), view);
    router.push(viewHref);
  };

  const onReloadFromDisk = async () => {
    const fresh = await api.diagram(workspace, diagramId);
    const freshDoc = docFromView(fresh);
    setView(fresh);
    setBase(freshDoc);
    commit(createHistory(freshDoc), fresh);
    setSave({ kind: "idle" });
  };

  const onExport = async (format: ExportFormat) => {
    if (!containerRef.current) return;
    setBusy(true);
    setExporting(true);
    try {
      // Let edges re-render without animation before capturing.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const url = await renderDiagramImage(containerRef.current, rf.getNodes(), format);
      downloadDataUrl(url, `${diagramId}.${format}`);
    } finally {
      setExporting(false);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) onUndo();
      else if ((key === "z" && e.shiftKey) || key === "y") onRedo();
      else if (key === "s") void onSave();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onRedo, onSave, onUndo]);

  // --- Rendering --------------------------------------------------------------
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(
    () =>
      toFlowEdges(
        view.diagram.edges,
        (id) => ({ edgeType: edgeTypeOf(view, doc, id), animated: edgeAnimatedOf(view, doc, id) }),
        { selected: selectedEdge, nodeIds },
      ).map((e) => ({
        ...e,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: `var(--arch-${e.data!.edge.style.color})`,
          width: 16,
          height: 16,
        },
      })),
    [view, doc, selectedEdge, nodeIds],
  );

  const selectedNode =
    selectedIds.length === 1 ? view.diagram.nodes.find((n) => n.id === selectedIds[0]) : undefined;
  const selectedEdgeData = selectedEdge
    ? view.diagram.edges.find((e) => e.id === selectedEdge)
    : undefined;
  const draft = view.persistence.draft;
  const orphans = view.layout.orphans;
  const nothingSelected = !selectedNode && !selectedEdgeData;
  const staleAlert = (
    <Alert variant="destructive">
      <AlertTitle>Showing the last valid model</AlertTitle>
      <AlertDescription>
        The latest YAML files have errors. The diagram refreshes once they are fixed.
      </AlertDescription>
    </Alert>
  );
  const selectionKey = `${selectedIds.join(",")}|${selectedEdge ?? ""}`;
  const panelClosed = closedSelection === selectionKey;
  const showViewPanel = !editing && ((!nothingSelected && !panelClosed) || diagnosticsOpen);

  const diagnosticsSection = (
    <section
      id="diagram-diagnostics"
      aria-labelledby="diagram-diagnostics-heading"
      className="flex flex-col gap-2"
    >
      <h2 id="diagram-diagnostics-heading" className="font-medium">
        Diagnostics
      </h2>
      {editing && view.modelStatus === "stale" && staleAlert}
      {(orphans.nodes.length > 0 || orphans.edges.length > 0) && (
        <Alert>
          <AlertTitle>Orphaned layout overrides</AlertTitle>
          <AlertDescription>
            The layout file has positions or edge styles for{" "}
            {[...orphans.nodes, ...orphans.edges].map((id) => `'${id}'`).join(", ")}, which are no
            longer in this diagram. Saving the layout removes them.
          </AlertDescription>
        </Alert>
      )}
      <DiagnosticsList diagnostics={view.diagnostics} />
    </section>
  );

  const inspectors = (
    <>
      {selectedNode && (
        <NodeInspector
          workspace={workspace}
          diagramId={diagramId}
          node={selectedNode}
          diagrams={diagrams}
        />
      )}
      {selectedEdgeData && (
        <EdgeInspector
          edge={selectedEdgeData}
          readOnly={readOnly}
          presentation={doc.edges[selectedEdgeData.id]}
          effectiveType={settings.edgeType}
          effectiveAnimated={settings.animateEdges}
          onChange={onEdgeChange}
          presentationControls={editing}
        />
      )}
    </>
  );

  const noticeAlert = notice && (
    <Alert>
      <AlertTitle>Reloaded</AlertTitle>
      <AlertDescription>
        <p>{notice}</p>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="mt-1"
          onClick={() => setNotice(null)}
        >
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );

  return (
    <EditorCallbacks.Provider value={callbacks}>
      <div className="flex min-h-0 flex-1 flex-col">
        {editing ? (
          <Toolbar
            readOnly={readOnly}
            canUndo={canUndo(history)}
            canRedo={canRedo(history)}
            selectedCount={selectedIds.length}
            dirty={dirty}
            saving={save.kind === "saving"}
            busy={busy}
            onUndo={onUndo}
            onRedo={onRedo}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onRelayout={() => void onRelayout()}
            onFitView={() => void rf.fitView({ padding: 0.1 })}
            onExport={(f) => void onExport(f)}
            onSave={() => void onSave()}
            onRevert={onRevert}
            onDone={onDone}
          />
        ) : (
          <ViewBar
            editHref={diagramHref(workspace, diagramId, "edit")}
            {...(view.persistence.writable
              ? {}
              : { notEditableReason: view.persistence.notWritableReason ?? "Layout is read-only" })}
            problems={view.diagnostics.length}
            diagnosticsOpen={diagnosticsOpen}
            busy={busy}
            onFitView={() => void rf.fitView({ padding: 0.1 })}
            onExport={(f) => void onExport(f)}
            onToggleDiagnostics={() => setDiagnosticsOpen((o) => !o)}
          />
        )}
        {confirmDone && (
          <div
            role="alertdialog"
            aria-labelledby="confirm-done-title"
            aria-describedby="confirm-done-text"
            className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950"
          >
            <span id="confirm-done-title" className="font-medium">
              Unsaved layout changes.
            </span>
            <span id="confirm-done-text">Save them before leaving the editor?</span>
            <div className="ml-auto flex gap-2">
              <Button type="button" size="sm" onClick={() => void onSaveAndClose()} autoFocus>
                Save and close
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onDiscardAndClose}>
                Discard changes
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDone(false)}>
                Keep editing
              </Button>
            </div>
          </div>
        )}
        {!editing && (view.modelStatus === "stale" || notice) && (
          <div className="flex flex-col gap-2 border-b px-4 py-2">
            {view.modelStatus === "stale" && staleAlert}
            {noticeAlert}
          </div>
        )}
        <div className="relative flex min-h-0 flex-1">
          <div
            ref={containerRef}
            className="arch-canvas relative min-h-0 flex-1"
            data-testid="diagram-canvas"
          >
            <ReactFlow<ArchFlowNode>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={onNodeDragStop}
              onEdgesChange={onEdgesChange}
              nodesDraggable={!readOnly}
              nodesFocusable
              elementsSelectable
              nodesConnectable={false}
              edgesReconnectable={false}
              deleteKeyCode={null}
              multiSelectionKeyCode={MULTI_SELECT_KEYS}
              snapToGrid={settings.snapToGrid}
              snapGrid={[settings.gridSize, settings.gridSize]}
              fitView
              fitViewOptions={{
                padding: 0.1,
                ...(focusIds.size ? { nodes: [...focusIds].map((id) => ({ id })) } : {}),
              }}
              minZoom={0.1}
              maxZoom={2.5}
              proOptions={{ hideAttribution: true }}
              aria-label={`${view.diagram.name} diagram`}
            >
              <Background variant={BackgroundVariant.Dots} gap={settings.gridSize} size={1} />
              <MiniMap
                pannable
                zoomable
                ariaLabel="Diagram overview"
                nodeColor={(n) => `var(--arch-${(n as ArchFlowNode).data.node.style.color})`}
                nodeStrokeWidth={0}
              />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          {editing ? (
            <aside
              aria-label="Diagram details"
              className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l bg-background p-4"
            >
              {readOnly && (
                <Alert>
                  <AlertTitle>Layout is read-only</AlertTitle>
                  <AlertDescription>{view.persistence.notWritableReason}</AlertDescription>
                </Alert>
              )}
              {save.kind === "conflict" && (
                <Alert variant="destructive">
                  <AlertTitle>Layout file changed outside the editor</AlertTitle>
                  <AlertDescription>
                    <p>{save.error.message}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void onReloadFromDisk()}
                    >
                      Discard my changes and reload
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {save.kind === "error" && (
                <Alert variant="destructive">
                  <AlertTitle>Layout not saved</AlertTitle>
                  <AlertDescription>
                    <p>{save.error.message}</p>
                    {save.error.issues && (
                      <ul className="list-disc pl-4">
                        {save.error.issues.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {noticeAlert}
              {draft && !draftDismissed && !readOnly && (
                <Alert variant={draft.status === "recoverable" ? "default" : "destructive"}>
                  <AlertTitle>Unsaved layout changes found</AlertTitle>
                  <AlertDescription>
                    <p>
                      {draft.status === "recoverable"
                        ? `Changes autosaved at ${new Date(draft.draft.savedAt).toLocaleString()} were never saved.`
                        : draft.status === "conflict"
                          ? "An autosaved draft exists, but the layout file has changed since. Restoring it will replace those changes when you save."
                          : draft.status === "incompatible"
                            ? `An autosaved draft no longer matches this diagram: ${draft.issues.join("; ")}`
                            : `An autosaved draft could not be read: ${draft.reason}`}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {(draft.status === "recoverable" || draft.status === "conflict") && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            change(docFromDraft(view, draft.draft.layout));
                            setDraftDismissed(true);
                          }}
                        >
                          Restore
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDraftDismissed(true);
                          void api.discardDraft(workspace, diagramId).catch(() => undefined);
                        }}
                      >
                        Discard draft
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {inspectors}
              {!selectedNode && !selectedEdgeData && (
                <p className="text-sm text-muted-foreground">
                  Select a node or edge to inspect it. Shift-drag to select several nodes.
                </p>
              )}
              <SettingsPanel
                readOnly={readOnly}
                effective={settings}
                overrides={doc.settings}
                onChange={onSetting}
                onRelayout={() => void onRelayout()}
              />
              {diagnosticsSection}
            </aside>
          ) : (
            showViewPanel && (
              <aside
                aria-label="Diagram details"
                className="absolute inset-y-0 right-0 z-10 flex w-80 flex-col gap-6 overflow-y-auto border-l bg-background p-4 shadow-lg"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="self-end"
                  aria-label="Close panel"
                  onClick={() => {
                    setDiagnosticsOpen(false);
                    setClosedSelection(selectionKey);
                  }}
                >
                  <X />
                </Button>
                {!panelClosed && inspectors}
                {diagnosticsOpen && diagnosticsSection}
              </aside>
            )
          )}
        </div>
      </div>
    </EditorCallbacks.Provider>
  );
}
