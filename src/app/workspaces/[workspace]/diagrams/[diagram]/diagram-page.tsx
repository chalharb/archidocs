/**
 * Shared server rendering for a diagram's view and edit routes (DIAG-12, ADD-007).
 * Not a route itself: page.tsx and edit/page.tsx render it with their mode.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DiagramEditor } from "@/components/diagram/diagram-editor";
import { DiagramSwitcher } from "@/components/diagram/diagram-switcher";
import { diagramHref, type DiagramMode } from "@/components/diagram/links";
import { getWorkspaceService } from "@/server/service";

export interface DiagramPageProps {
  params: Promise<{ workspace: string; diagram: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: DiagramMode;
}

async function DiagramContent({ params, searchParams, mode }: DiagramPageProps) {
  await connection(); // always read the current workspace state
  const { workspace, diagram } = await params;
  const { focus } = await searchParams;
  const entry = await getWorkspaceService().get(workspace);
  if (!entry || entry.status !== "ready") notFound();
  const repo = entry.repository!;
  const view = await repo.diagramView(diagram);
  if (!view) notFound();
  const model = repo.snapshot().model;
  const diagrams = Object.values(model.diagrams).map((d) => ({ id: d.id, name: d.name }));
  const editing = mode === "edit";
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link href="/" className="underline-offset-2 hover:underline">
            {model.workspace?.name ?? workspace}
          </Link>
          <span className="mx-2 text-muted-foreground" aria-hidden>
            /
          </span>
          {editing && (
            <>
              <Link
                href={diagramHref(workspace, view.diagram.id)}
                className="underline-offset-2 hover:underline"
              >
                {view.diagram.name}
              </Link>
              <span className="mx-2 text-muted-foreground" aria-hidden>
                /
              </span>
            </>
          )}
        </nav>
        <h1 className="text-lg font-semibold">
          {editing ? `Edit layout: ${view.diagram.name}` : view.diagram.name}
        </h1>
        <span className="text-sm text-muted-foreground">{view.diagram.diagramType}</span>
        {!editing && (
          <DiagramSwitcher workspace={workspace} current={view.diagram.id} diagrams={diagrams} />
        )}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <DiagramEditor
          key={`${view.diagram.id}:${mode}`}
          workspace={workspace}
          initialView={view}
          diagrams={diagrams}
          mode={mode}
          {...(typeof focus === "string" ? { focus } : {})}
        />
      </main>
    </>
  );
}

export function DiagramPage(props: DiagramPageProps) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<p className="p-4">Loading diagram…</p>}>
        <DiagramContent {...props} />
      </Suspense>
    </div>
  );
}
