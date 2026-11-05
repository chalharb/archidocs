import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspaceSummary, type WorkspaceSummaryProps } from "@/components/workspace-summary";
import { getWorkspaceService } from "@/server/service";
import { staleNotice } from "@/server/workspace/repository";

async function loadSummaries(): Promise<WorkspaceSummaryProps[]> {
  await connection(); // always read the current workspace state
  const entries = await getWorkspaceService().list();
  return entries.map((entry) => {
    if (entry.status === "error") {
      return {
        workspaceKey: entry.key,
        name: entry.key,
        status: "unavailable",
        error: entry.error,
      };
    }
    const snap = entry.repository!.snapshot();
    const notice = staleNotice(snap);
    return {
      workspaceKey: entry.key,
      name: snap.model.workspace?.name ?? entry.key,
      status: snap.status,
      loadedAt: snap.loadedAt,
      counts: {
        entities: Object.keys(snap.model.entities).length,
        relationships: Object.keys(snap.model.relationships).length,
        diagrams: Object.keys(snap.model.diagrams).length,
      },
      diagrams: Object.values(snap.model.diagrams).map((d) => ({
        id: d.id,
        name: d.name,
        diagramType: d.diagramType,
      })),
      documentation: {
        documents: Object.keys(snap.model.documents).length,
        decisions: Object.keys(snap.model.decisions).length,
      },
      diagnostics: notice ? [notice, ...snap.diagnostics] : snap.diagnostics,
    };
  });
}

async function Workspaces() {
  const summaries = await loadSummaries();
  return (
    <div className="flex flex-col gap-6">
      {summaries.map((s) => (
        <WorkspaceSummary key={s.workspaceKey} {...s} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Architecture Docs</h1>
        <p className="text-muted-foreground">Workspace status, loaded from YAML.</p>
      </header>
      <Suspense fallback={<p>Loading workspaces…</p>}>
        <Workspaces />
      </Suspense>
    </main>
  );
}
