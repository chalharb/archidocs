/**
 * Diagnostics are the single channel for reporting problems in a workspace.
 * They are plain, JSON-serializable data so they can cross the server/client boundary.
 */

export type Severity = "error" | "warning" | "info";

export const DIAGNOSTIC_CODES = [
  // YAML syntax and safety (SEC-05, SEC-06)
  "YAML_SYNTAX",
  "YAML_UNSAFE_TAG",
  "YAML_TOO_DEEP",
  "YAML_TOO_LARGE",
  "YAML_ALIAS_LIMIT",
  "YAML_NOT_A_MAPPING",
  // Resource schema (SCHEMA-01, SCHEMA-07, SCHEMA-08)
  "SCHEMA_MISSING_VERSION",
  "SCHEMA_UNSUPPORTED_VERSION",
  "SCHEMA_UNKNOWN_KIND",
  "SCHEMA_UNKNOWN_FIELD",
  "SCHEMA_REQUIRED_FIELD",
  "SCHEMA_INVALID_VALUE",
  "SCHEMA_MIGRATED",
  "SCHEMA_MIGRATION_FAILED",
  // Cross-resource validation (SCHEMA-03..06, MODEL-07, MODEL-10)
  "ID_DUPLICATE",
  "COLLECTION_ID_CONFLICT",
  "WORKSPACE_DUPLICATE",
  "WORKSPACE_MISSING",
  "REF_MISSING",
  "HIERARCHY_CYCLE",
  "TYPE_INHERITANCE_CYCLE",
  "RELATIONSHIP_ENDPOINT_TYPE",
  "SECRET_SUSPECTED",
  // Diagrams
  "DIAGRAM_DUPLICATE_NODE",
  "DIAGRAM_DUPLICATE_EDGE",
  "DIAGRAM_ENDPOINT_MISMATCH",
  "DIAGRAM_ENDPOINT_AMBIGUOUS",
  // Layout (LAYOUT-13, LAYOUT-18, LAYOUT-24)
  "LAYOUT_DUPLICATE",
  "LAYOUT_ORPHAN_DIAGRAM",
  "LAYOUT_ORPHAN_NODE",
  "LAYOUT_ORPHAN_EDGE",
  "LAYOUT_COLLISION",
  // Filesystem (SEC-02..04, SEC-06, RELI-*)
  "FS_OUTSIDE_ROOT",
  "FS_SYMLINK_REJECTED",
  "FS_TOO_LARGE",
  "FS_TOO_MANY_FILES",
  "FS_READ_ERROR",
  // Workspace state (RELI-04)
  "MODEL_STALE",
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export type DiagnosticPath = ReadonlyArray<string | number>;

export interface DiagnosticLocation {
  /** Workspace-relative POSIX path. */
  readonly file?: string;
  /** Zero-based index of the YAML document within a multi-document file. */
  readonly document?: number;
  /** Path to the offending value inside the document. */
  readonly path?: DiagnosticPath;
  /** One-based line number, when known. */
  readonly line?: number;
  /** One-based column number, when known. */
  readonly column?: number;
}

export interface Diagnostic extends DiagnosticLocation {
  readonly severity: Severity;
  readonly code: DiagnosticCode;
  readonly message: string;
  /** Actionable advice for fixing the problem (RELI-05, SCHEMA-08). */
  readonly hint?: string;
  /** Other locations involved (e.g. the first definition of a duplicate ID). */
  readonly related?: readonly DiagnosticLocation[];
}

export function diagnostic(
  severity: Severity,
  code: DiagnosticCode,
  message: string,
  extra: Omit<Diagnostic, "severity" | "code" | "message"> = {},
): Diagnostic {
  const d: Record<string, unknown> = { severity, code, message };
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) d[k] = v;
  }
  return d as unknown as Diagnostic;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function formatPath(path: DiagnosticPath | undefined): string {
  if (!path || path.length === 0) return "";
  return path.map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? p : `.${p}`)).join("");
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deterministic ordering: file, document, path, severity, code, message. */
export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    compareStrings(a.file ?? "", b.file ?? "") ||
    (a.document ?? -1) - (b.document ?? -1) ||
    compareStrings(formatPath(a.path), formatPath(b.path)) ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.message, b.message)
  );
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}

export function countBySeverity(diagnostics: readonly Diagnostic[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity] += 1;
  return counts;
}
