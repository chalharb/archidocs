/**
 * Documents and decisions that reference an entity or diagram (DOC-05).
 * Decisions are grouped by status, newest first within each group.
 */
import Link from "next/link";
import { DECISION_STATUSES } from "@/domain/resources";
import type { DocumentationRefs } from "@/server/workspace/documentation-views";
import { STATUS_LABEL } from "./decision-status";
import { decisionHref, documentHref } from "./links";

export function DocumentationRefsList({
  workspace,
  refs,
  headingLevel = 3,
}: {
  workspace: string;
  refs: DocumentationRefs;
  headingLevel?: 2 | 3 | 4;
}) {
  const H = (["h2", "h3", "h4"] as const)[headingLevel - 2]!;
  if (refs.documents.length === 0 && refs.decisions.length === 0) {
    return <p className="text-muted-foreground">No documents or decisions reference this.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {refs.documents.length > 0 && (
        <div>
          <H className="font-medium">Documents</H>
          <ul aria-label="Documents">
            {refs.documents.map((d) => (
              <li key={d.id}>
                <Link className="underline underline-offset-2" href={documentHref(workspace, d.id)}>
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {DECISION_STATUSES.map((status) => {
        const group = refs.decisions.filter((d) => d.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <H className="font-medium">{STATUS_LABEL[status]} decisions</H>
            <ul aria-label={`${STATUS_LABEL[status]} decisions`}>
              {group.map((d) => (
                <li key={d.id}>
                  <Link
                    className="underline underline-offset-2"
                    href={decisionHref(workspace, d.id)}
                  >
                    {d.id}: {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
