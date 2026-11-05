import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countBySeverity, type Diagnostic } from "@/domain/diagnostics";
import { DiagnosticsList } from "./diagnostics-list";

export interface WorkspaceSummaryProps {
  workspaceKey: string;
  name: string;
  status: "valid" | "invalid" | "stale" | "unavailable";
  error?: string;
  loadedAt?: string;
  counts?: { entities: number; relationships: number; diagrams: number };
  diagrams?: Array<{ id: string; name: string; diagramType: string }>;
  /** Number of documents and decisions (DOC-06). */
  documentation?: { documents: number; decisions: number };
  diagnostics?: readonly Diagnostic[];
}

const STATUS_LABEL: Record<WorkspaceSummaryProps["status"], string> = {
  valid: "Valid",
  invalid: "Invalid",
  stale: "Stale",
  unavailable: "Unavailable",
};

export function WorkspaceSummary(props: WorkspaceSummaryProps) {
  const diagnostics = props.diagnostics ?? [];
  const counts = countBySeverity(diagnostics);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {props.name}
            <Badge variant={props.status === "valid" ? "default" : "destructive"}>
              {STATUS_LABEL[props.status]}
            </Badge>
          </h2>
        </CardTitle>
        <CardDescription>
          Workspace <code>{props.workspaceKey}</code>
          {props.loadedAt && <> · loaded {props.loadedAt}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {props.status === "unavailable" && (
          <Alert variant="destructive">
            <AlertTitle>Workspace could not be opened</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}
        {props.status === "stale" && (
          <Alert variant="destructive">
            <AlertTitle>Showing the last valid model</AlertTitle>
            <AlertDescription>
              The latest YAML files have errors. Fix them and the model will refresh automatically.
            </AlertDescription>
          </Alert>
        )}
        {props.counts && (
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {(["entities", "relationships", "diagrams"] as const).map((k) => (
              <div key={k}>
                <dt className="text-muted-foreground capitalize">{k}</dt>
                <dd className="text-xl font-semibold">{props.counts![k]}</dd>
              </div>
            ))}
          </dl>
        )}
        {props.diagrams && props.diagrams.length > 0 && (
          <section aria-label={`Diagrams in workspace ${props.workspaceKey}`}>
            <h3 id={`${props.workspaceKey}-diagrams`} className="mb-1 font-medium">
              Diagrams
            </h3>
            <ul className="text-sm">
              {props.diagrams.map((d) => (
                <li key={d.id}>
                  <Link
                    className="underline underline-offset-2"
                    href={`/workspaces/${encodeURIComponent(props.workspaceKey)}/diagrams/${encodeURIComponent(d.id)}`}
                  >
                    {d.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">({d.diagramType})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {props.documentation && (
          <section aria-label={`Documentation in workspace ${props.workspaceKey}`}>
            <h3 className="mb-1 font-medium">Documentation</h3>
            <ul className="text-sm">
              <li>
                <Link
                  className="underline underline-offset-2"
                  href={`/workspaces/${encodeURIComponent(props.workspaceKey)}/docs`}
                >
                  Documents
                </Link>{" "}
                <span className="text-muted-foreground">({props.documentation.documents})</span>
              </li>
              <li>
                <Link
                  className="underline underline-offset-2"
                  href={`/workspaces/${encodeURIComponent(props.workspaceKey)}/decisions`}
                >
                  Decisions
                </Link>{" "}
                <span className="text-muted-foreground">({props.documentation.decisions})</span>
              </li>
            </ul>
          </section>
        )}
        {props.status !== "unavailable" && (
          <section aria-label={`Diagnostics for workspace ${props.workspaceKey}`}>
            <h3 id={`${props.workspaceKey}-diagnostics`} className="mb-1 font-medium">
              Diagnostics ({counts.error} errors, {counts.warning} warnings)
            </h3>
            <DiagnosticsList diagnostics={diagnostics} />
          </section>
        )}
      </CardContent>
    </Card>
  );
}
