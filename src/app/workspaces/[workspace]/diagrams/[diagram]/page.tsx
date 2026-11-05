import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DiagramEditor } from "@/components/diagram/diagram-editor";
import { DiagramSwitcher } from "@/components/diagram/diagram-switcher";
import { getWorkspaceService } from "@/server/service";

type Props = PageProps<"/workspaces/[workspace]/diagrams/[diagram]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { diagram } = await params;
  return { title: `${diagram} · Architecture Docs` };
}

async function DiagramContent({ params, searchParams }: Props) {
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
        </nav>
        <h1 className="text-lg font-semibold">{view.diagram.name}</h1>
        <span className="text-sm text-muted-foreground">{view.diagram.diagramType}</span>
        <DiagramSwitcher workspace={workspace} current={view.diagram.id} diagrams={diagrams} />
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <DiagramEditor
          key={view.diagram.id}
          workspace={workspace}
          initialView={view}
          diagrams={diagrams}
          {...(typeof focus === "string" ? { focus } : {})}
        />
      </main>
    </>
  );
}

export default function DiagramPage(props: Props) {
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<p className="p-4">Loading diagram…</p>}>
        <DiagramContent {...props} />
      </Suspense>
    </div>
  );
}
