import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DecisionStatusBadge, STATUS_LABEL } from "@/components/docs/decision-status";
import { DocShell } from "@/components/docs/doc-shell";
import { decisionHref, decisionsHref, entityHref } from "@/components/docs/links";
import { workspaceOr404 } from "@/components/docs/workspace";
import { Button } from "@/components/ui/button";
import { DECISION_STATUSES } from "@/domain/resources";
import { decisionList } from "@/server/workspace/documentation-views";

type Props = PageProps<"/workspaces/[workspace]/decisions">;

export const metadata: Metadata = { title: "Decisions · Architecture Docs" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const select = "h-8 rounded-md border bg-background px-2";

async function Decisions({ params, searchParams }: Props) {
  await connection();
  const { workspace } = await params;
  const query = await searchParams;
  const status = one(query.status);
  const entity = one(query.entity);
  const tag = one(query.tag);
  const { snapshot, home } = await workspaceOr404(workspace);
  const { model } = snapshot;
  const all = decisionList(model);
  const entities = [...new Set(all.flatMap((d) => d.entities))]
    .filter((id) => model.entities[id])
    .sort((a, b) => model.entities[a]!.name.localeCompare(model.entities[b]!.name));
  const tags = [...new Set(all.flatMap((d) => d.tags))].sort();
  const shown = all.filter(
    (d) =>
      (!status || d.status === status) &&
      (!entity || d.entities.includes(entity)) &&
      (!tag || d.tags.includes(tag)),
  );
  return (
    <DocShell
      workspace={workspace}
      version={snapshot.version}
      status={snapshot.status}
      crumbs={[home]}
      title="Decisions"
    >
      <form
        // Remount on navigation so the controls show the current filters.
        key={`${status}|${entity}|${tag}`}
        role="search"
        aria-label="Filter decisions"
        className="flex flex-wrap items-end gap-2 text-sm"
      >
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={status} className={select}>
            <option value="">Any status</option>
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Entity
          <select name="entity" defaultValue={entity} className={select}>
            <option value="">Any entity</option>
            {entities.map((id) => (
              <option key={id} value={id}>
                {model.entities[id]!.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Tag
          <select name="tag" defaultValue={tag} className={select}>
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
        {(status || entity || tag) && (
          <Link href={decisionsHref(workspace)} className="underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {all.length} decisions
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">Decision log, newest first</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-3 font-medium">
              Decision
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Date
            </th>
            <th scope="col" className="py-2 font-medium">
              Entities
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((d) => (
            <tr
              key={d.id}
              data-decision={d.id}
              data-status={d.status}
              className={`border-b align-top ${d.status === "superseded" ? "text-muted-foreground" : ""}`}
            >
              <td className="py-2 pr-3">
                <Link className="underline underline-offset-2" href={decisionHref(workspace, d.id)}>
                  <span className="font-mono text-xs">{d.id}</span> {d.title}
                </Link>
              </td>
              <td className="py-2 pr-3">
                <DecisionStatusBadge status={d.status} />
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">{d.date}</td>
              <td className="py-2">
                {d.entities
                  .filter((id) => model.entities[id])
                  .map((id, i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <Link
                        className="underline underline-offset-2"
                        href={entityHref(workspace, id)}
                      >
                        {model.entities[id]!.name}
                      </Link>
                    </span>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DocShell>
  );
}

/** Decision log (ADR-04). */
export default function DecisionsPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-4">Loading decisions…</p>}>
      <Decisions {...props} />
    </Suspense>
  );
}
