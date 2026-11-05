import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DecisionStatusBadge } from "@/components/docs/decision-status";
import { DocShell } from "@/components/docs/doc-shell";
import { decisionHref, decisionsHref } from "@/components/docs/links";
import { Markdown } from "@/components/docs/markdown";
import { FileDiagnostics, MetaRow, RefLinks } from "@/components/docs/page-parts";
import { workspaceOr404 } from "@/components/docs/workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { NamedRef } from "@/server/workspace/documentation-views";
import { decisionPage } from "@/server/workspace/documentation-views";

type Props = PageProps<"/workspaces/[workspace]/decisions/[decision]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { decision } = await params;
  return { title: `${decision} · Architecture Docs` };
}

function DecisionLinks({ workspace, refs }: { workspace: string; refs: NamedRef[] }) {
  return refs.map((r, i) => (
    <span key={r.id}>
      {i > 0 && ", "}
      <Link className="underline underline-offset-2" href={decisionHref(workspace, r.id)}>
        {r.id}: {r.title}
      </Link>
    </span>
  ));
}

async function DecisionContent({ params }: Props) {
  await connection();
  const { workspace, decision: id } = await params;
  const { snapshot, home } = await workspaceOr404(workspace);
  const view = decisionPage(snapshot, id);
  if (!view) notFound();
  const d = view.decision;
  return (
    <DocShell
      workspace={workspace}
      version={snapshot.version}
      status={view.modelStatus}
      crumbs={[home, { label: "Decisions", href: decisionsHref(workspace) }]}
      title={
        <>
          <span className="font-mono text-base text-muted-foreground">{d.id}</span> {d.title}
        </>
      }
      actions={<DecisionStatusBadge status={d.status} />}
    >
      {view.supersededBy.length > 0 && (
        <Alert>
          <AlertTitle>This decision has been superseded</AlertTitle>
          <AlertDescription>
            <p>
              Superseded by <DecisionLinks workspace={workspace} refs={view.supersededBy} />.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {d.description && <p className="text-muted-foreground">{d.description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <MetaRow label="Date">{d.date}</MetaRow>
        {d.deciders.length > 0 && <MetaRow label="Deciders">{d.deciders.join(", ")}</MetaRow>}
        {view.supersedes.length > 0 && (
          <MetaRow label="Supersedes">
            <DecisionLinks workspace={workspace} refs={view.supersedes} />
          </MetaRow>
        )}
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

/** A rendered decision with its supersession chain (ADR-05). */
export default function DecisionPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4">Loading decision…</p>}>
      <DecisionContent {...props} />
    </Suspense>
  );
}
