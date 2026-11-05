/** Deterministic ordering helpers (SCHEMA-09). Locale-independent code-point comparison. */
import type { SourceRef } from "./resources";

export function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareSources(a: SourceRef, b: SourceRef): number {
  return (
    compareCodePoints(a.file, b.file) ||
    a.document - b.document ||
    compareCodePoints(JSON.stringify(a.path), JSON.stringify(b.path))
  );
}

/** Copy of `record` with keys inserted in code-point order. */
export function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort(compareCodePoints)) out[key] = record[key]!;
  return out;
}
