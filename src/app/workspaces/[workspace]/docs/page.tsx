import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DocShell } from "@/components/docs/doc-shell";
import { documentHref, documentsHref } from "@/components/docs/links";
import { workspaceOr404 } from "@/components/docs/workspace";
import { Button } from "@/components/ui/button";
import { documentList } from "@/server/workspace/documentation-views";

type Props = PageProps<"/workspaces/[workspace]/docs">;

export const metadata: Metadata = { title: "Documents · Architecture Docs" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function Documents({ params, searchParams }: Props) {
  await connection();
  const { workspace } = await params;
  const query = await searchParams;
  const q = one(query.q).trim();
  const tag = one(query.tag);
  const { snapshot, home } = await workspaceOr404(workspace);
  const all = documentList(snapshot.model);
  const tags = [...new Set(all.flatMap((d) => d.tags))].sort();
  const shown = all.filter(
    (d) =>
      (!q || d.title.toLowerCase().includes(q.toLowerCase())) && (!tag || d.tags.includes(tag)),
  );
  return (
    <DocShell
      workspace={workspace}
      version={snapshot.version}
      status={snapshot.status}
      crumbs={[home]}
      title="Documents"
    >
      <form
        // Remount on navigation so the controls show the current filters.
        key={`${q}|${tag}`}
        role="search"
        aria-label="Filter documents"
        className="flex flex-wrap items-end gap-2 text-sm"
      >
        <label className="flex flex-col gap-1">
          Title
          <input name="q" defaultValue={q} className="h-8 rounded-md border bg-background px-2" />
        </label>
        <label className="flex flex-col gap-1">
          Tag
          <select
            name="tag"
            defaultValue={tag}
            className="h-8 rounded-md border bg-background px-2"
          >
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {(q || tag) && (
          <Link href={documentsHref(workspace)} className="underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {all.length} documents
      </p>
      <ul aria-label="Documents" className="flex flex-col gap-3">
        {shown.map((d) => (
          <li key={d.id} className="rounded-md border p-3">
            <Link
              className="font-medium underline underline-offset-2"
              href={documentHref(workspace, d.id)}
            >
              {d.title}
            </Link>
            {d.description && <p className="text-sm">{d.description}</p>}
            {d.tags.length > 0 && (
              <p className="text-xs text-muted-foreground">Tags: {d.tags.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </DocShell>
  );
}

/** Document index (DOC-06). */
export default function DocumentsPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4">Loading documents…</p>}>
      <Documents {...props} />
    </Suspense>
  );
}
