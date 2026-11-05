import { Badge } from "@/components/ui/badge";
import { formatPath, type Diagnostic, type Severity } from "@/domain/diagnostics";

const VARIANT: Record<Severity, "destructive" | "secondary" | "outline"> = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
};

export function location(d: Diagnostic): string {
  const parts = [
    d.file,
    d.line !== undefined ? `${d.line}${d.column !== undefined ? `:${d.column}` : ""}` : undefined,
  ]
    .filter(Boolean)
    .join(":");
  const path = formatPath(d.path);
  return [parts, path && `(${path})`].filter(Boolean).join(" ");
}

/** Actionable list of file and schema diagnostics (RELI-05, DIAG-10). */
export function DiagnosticsList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return <p className="text-sm text-muted-foreground">No problems found.</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Diagnostics">
      {diagnostics.map((d, i) => (
        <li key={i} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={VARIANT[d.severity]}>{d.severity}</Badge>
            <code className="text-xs text-muted-foreground">{d.code}</code>
            {location(d) && <span className="font-mono text-xs">{location(d)}</span>}
          </div>
          <p className="mt-1">{d.message}</p>
          {d.hint && <p className="mt-1 text-muted-foreground">{d.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
