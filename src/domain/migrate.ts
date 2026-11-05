/**
 * Schema migrations (SCHEMA-10): upgrade documents written for an older
 * `apiVersion` to the current one, guaranteeing canonical IDs survive.
 *
 * - A migration is a pure function from one version's document to the next.
 * - Each migration declares how to read canonical IDs from its *source*
 *   format; the current format's reader is `canonicalIdsV1`.
 * - After every step the guard compares the ID sets. Any ID added, dropped
 *   or renamed fails the migration, so an upgrade can never silently break
 *   references from other files, diagrams or layouts.
 * - Migrations run in memory when files are loaded; files on disk are not
 *   rewritten.
 *
 * Design notes: docs/schema-migrations.md.
 */
import { API_VERSION } from "./resources";

export type RawDocument = Record<string, unknown>;

export interface Migration {
  /** Source `apiVersion`, e.g. "archdocs/v0". */
  from: string;
  /** Target `apiVersion`; the chain must end at the current version. */
  to: string;
  /** Pure transform; receives a private copy of the document. */
  migrate(document: RawDocument): RawDocument;
  /** Canonical IDs of a document in the `from` format (see `canonicalIdsV1`). */
  canonicalIds(document: RawDocument): string[];
}

/** Registered migrations, oldest first. Empty while `archdocs/v1` is the only version. */
export const MIGRATIONS: readonly Migration[] = [];

export class MigrationError extends Error {
  constructor(
    message: string,
    readonly from: string,
    readonly to: string,
    readonly lost: string[] = [],
    readonly added: string[] = [],
  ) {
    super(message);
    this.name = "MigrationError";
  }
}

const str = (v: unknown): v is string => typeof v === "string";
const items = (v: unknown): RawDocument[] =>
  Array.isArray(v) ? v.filter((x): x is RawDocument => typeof x === "object" && x !== null) : [];
const keys = (v: unknown): string[] =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? Object.keys(v) : [];

/**
 * Canonical IDs of an `archdocs/v1` document, as category-qualified keys.
 * Categories, not kinds, are used so that e.g. moving an entity from an
 * `Entity` resource into an `EntitySet` keeps the same key. Tolerates
 * malformed input: anything that is not where an ID belongs is ignored.
 */
export function canonicalIdsV1(doc: RawDocument): string[] {
  const out: string[] = [];
  const add = (category: string, id: unknown) => str(id) && out.push(`${category}:${id}`);
  switch (doc.kind) {
    case "Workspace":
      add("workspace", doc.id);
      break;
    case "Project":
      add("project", doc.id);
      break;
    case "EntityType":
      add("entityType", doc.id);
      break;
    case "RelationshipType":
      add("relationshipType", doc.id);
      break;
    case "Entity":
      add("entity", doc.id);
      break;
    case "EntitySet":
      add("collection", doc.id);
      for (const e of items(doc.entities)) add("entity", e.id);
      break;
    case "RelationshipSet":
      add("collection", doc.id);
      for (const r of items(doc.relationships)) add("relationship", r.id);
      break;
    case "Diagram":
      add("diagram", doc.id);
      if (str(doc.id)) {
        for (const n of items(doc.nodes)) add(`node:${doc.id}`, n.id ?? n.entity);
        for (const e of items(doc.edges)) add(`edge:${doc.id}`, e.id ?? e.relationship);
      }
      break;
    case "DiagramLayout":
      add("layout", doc.diagram);
      if (str(doc.diagram)) {
        for (const id of keys(doc.nodes)) add(`layoutNode:${doc.diagram}`, id);
        for (const id of keys(doc.edges)) add(`layoutEdge:${doc.diagram}`, id);
      }
      break;
  }
  return out.sort();
}

/** The chain of migrations from `version` to the current version, or null if there is none. */
export function migrationPath(
  version: string,
  migrations: readonly Migration[] = MIGRATIONS,
): Migration[] | null {
  const path: Migration[] = [];
  let current = version;
  while (current !== API_VERSION) {
    const step = migrations.find((m) => m.from === current);
    if (!step || path.includes(step)) return null; // no route, or a cycle
    path.push(step);
    current = step.to;
  }
  return path;
}

/** Multiset difference a − b, so duplicate counts matter too. */
function difference(a: string[], b: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const x of b) remaining.set(x, (remaining.get(x) ?? 0) + 1);
  return a.filter((x) => {
    const n = remaining.get(x) ?? 0;
    if (n === 0) return true;
    remaining.set(x, n - 1);
    return false;
  });
}

/**
 * Upgrade `document` to the current `apiVersion`.
 * Returns `null` when no migration path exists (the caller reports an unsupported version).
 * Throws `MigrationError` when a step fails or changes canonical IDs.
 */
export function migrateDocument(
  document: RawDocument,
  migrations: readonly Migration[] = MIGRATIONS,
): RawDocument | null {
  const version = document.apiVersion;
  if (!str(version)) return null;
  const path = migrationPath(version, migrations);
  if (!path) return null;

  let current = document;
  path.forEach((step, i) => {
    const readTarget = path[i + 1]?.canonicalIds ?? canonicalIdsV1;
    const before = step.canonicalIds(current);
    let next: RawDocument;
    try {
      next = step.migrate(structuredClone(current));
    } catch (err) {
      throw new MigrationError(
        `Migration ${step.from} → ${step.to} failed: ${(err as Error).message}`,
        step.from,
        step.to,
      );
    }
    if (typeof next !== "object" || next === null || next.apiVersion !== step.to) {
      throw new MigrationError(
        `Migration ${step.from} → ${step.to} did not produce an '${step.to}' document`,
        step.from,
        step.to,
      );
    }
    const after = readTarget(next);
    const lost = difference(before, after);
    const added = difference(after, before);
    if (lost.length > 0 || added.length > 0) {
      throw new MigrationError(
        `Migration ${step.from} → ${step.to} changed canonical IDs` +
          (lost.length ? `; lost: ${lost.join(", ")}` : "") +
          (added.length ? `; added: ${added.join(", ")}` : ""),
        step.from,
        step.to,
        lost,
        added,
      );
    }
    current = next;
  });
  return current;
}
