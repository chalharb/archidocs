import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { diagramHref } from "@/components/diagram/links";
import { DocShell } from "@/components/docs/doc-shell";
import { DocumentationRefsList } from "@/components/docs/documentation-refs";
import { entityHref } from "@/components/docs/links";
import { MetaRow } from "@/components/docs/page-parts";
import { workspaceOr404 } from "@/components/docs/workspace";

type Props = PageProps<"/workspaces/[workspace]/entities/[entity]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entity } = await params;
  return { title: `${entity} · Architecture Docs` };
}

async function EntityContent({ params }: Props) {
  await connection();
  const { workspace, entity: id } = await params;
  const { repository, snapshot, home } = await workspaceOr404(workspace);
  const view = repository.entityView(id);
  if (!view) notFound();
  const { model } = snapshot;
  const e = view.entity;
  return (
    <DocShell
      workspace={workspace}
      version={snapshot.version}
      status={snapshot.status}
      crumbs={[home]}
      title={e.name}
    >
      {e.description && <p>{e.description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <MetaRow label="Entity">
          <code>{e.id}</code>
        </MetaRow>
        <MetaRow label="Type">{model.entityTypes[e.type]?.name ?? e.type}</MetaRow>
        {e.technology && <MetaRow label="Technology">{e.technology}</MetaRow>}
        {e.owner && <MetaRow label="Owner">{e.owner}</MetaRow>}
        {view.parent && (
          <MetaRow label="Part of">
            <Link
              className="underline underline-offset-2"
              href={entityHref(workspace, view.parent)}
            >
              {model.entities[view.parent]?.name ?? view.parent}
            </Link>
          </MetaRow>
        )}
        {e.tags.length > 0 && <MetaRow label="Tags">{e.tags.join(", ")}</MetaRow>}
      </dl>
      <section aria-labelledby="entity-diagrams" className="flex flex-col gap-1 text-sm">
        <h2 id="entity-diagrams" className="font-medium">
          Diagrams
        </h2>
        {view.diagrams.length === 0 ? (
          <p className="text-muted-foreground">Not shown in any diagram.</p>
        ) : (
          <ul aria-label="Diagrams showing this entity">
            {view.diagrams.map((d) => (
              <li key={d}>
                <Link
                  className="underline underline-offset-2"
                  href={diagramHref(workspace, d, "view", id)}
                >
                  {model.diagrams[d]?.name ?? d}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="entity-docs" className="flex flex-col gap-1 text-sm">
        <h2 id="entity-docs" className="font-medium">
          Documentation
        </h2>
        <DocumentationRefsList workspace={workspace} refs={view.documentation} />
      </section>
    </DocShell>
  );
}

/** An entity with its diagrams and documentation (DOC-05, DOC-06). */
export default function EntityPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4">Loading entity…</p>}>
      <EntityContent {...props} />
    </Suspense>
  );
}
