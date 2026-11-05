/** Shared parts of document and decision pages (DOC-06, ADR-05). */
import Link from "next/link";
import { DiagnosticsList } from "@/components/diagnostics-list";
import { diagramHref } from "@/components/diagram/links";
import type { NamedRef } from "@/server/workspace/documentation-views";
import type { Diagnostic } from "@/domain/diagnostics";
import { entityHref } from "./links";

export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function RefLinks({
  workspace,
  entities,
  diagrams,
}: {
  workspace: string;
  entities: NamedRef[];
  diagrams: NamedRef[];
}) {
  return (
    <>
      {entities.length > 0 && (
        <MetaRow label="Entities">
          <ul aria-label="Referenced entities" className="flex flex-wrap gap-x-3">
            {entities.map((e) => (
              <li key={e.id}>
                <Link className="underline underline-offset-2" href={entityHref(workspace, e.id)}>
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </MetaRow>
      )}
      {diagrams.length > 0 && (
        <MetaRow label="Diagrams">
          <ul aria-label="Referenced diagrams" className="flex flex-wrap gap-x-3">
            {diagrams.map((d) => (
              <li key={d.id}>
                <Link className="underline underline-offset-2" href={diagramHref(workspace, d.id)}>
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </MetaRow>
      )}
    </>
  );
}

export function FileDiagnostics({
  file,
  diagnostics,
}: {
  file: string;
  diagnostics: Diagnostic[];
}) {
  return (
    <section aria-labelledby="file-diagnostics" className="flex flex-col gap-2 border-t pt-4">
      <h2 id="file-diagnostics" className="font-medium">
        Diagnostics
      </h2>
      <p className="text-sm text-muted-foreground">
        Source: <code>{file}</code>
      </p>
      <DiagnosticsList diagnostics={diagnostics} />
    </section>
  );
}
