import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocShell } from "@/components/docs/doc-shell";
import { documentsHref } from "@/components/docs/links";
import { Markdown } from "@/components/docs/markdown";
import { FileDiagnostics, MetaRow, RefLinks } from "@/components/docs/page-parts";
import { workspaceOr404 } from "@/components/docs/workspace";
import { documentPage } from "@/server/workspace/documentation-views";

type Props = PageProps<"/workspaces/[workspace]/docs/[document]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { document } = await params;
  return { title: `${document} · Architecture Docs` };
}

async function DocumentContent({ params }: Props) {
  await connection();
  const { workspace, document: id } = await params;
  const { snapshot, home } = await workspaceOr404(workspace);
  const view = documentPage(snapshot, id);
  if (!view) notFound();
  const d = view.document;
  return (
    <DocShell
      workspace={workspace}
      version={snapshot.version}
      status={view.modelStatus}
      crumbs={[home, { label: "Documents", href: documentsHref(workspace) }]}
      title={d.title}
    >
      {d.description && <p className="text-muted-foreground">{d.description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {d.owner && <MetaRow label="Owner">{d.owner}</MetaRow>}
        {d.tags.length > 0 && <MetaRow label="Tags">{d.tags.join(", ")}</MetaRow>}
        <RefLinks workspace={workspace} entities={view.entities} diagrams={view.diagrams} />
      </dl>
      <article aria-label={d.title}>
        <Markdown markdown={d.body.text} workspace={workspace} links={view.links} />
      </article>
      <FileDiagnostics file={view.file} diagnostics={view.diagnostics} />
    </DocShell>
  );
}

/** A rendered document (DOC-06). */
export default function DocumentPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4">Loading document…</p>}>
      <DocumentContent {...props} />
    </Suspense>
  );
}
