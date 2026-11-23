import { Bundle, SCHEMA_VERSION } from "../schema/bundle.ts";

/** Upgrades a Bundle by one `schemaVersion`, from the version it is keyed by to the next. */
export type Migration = (bundle: Record<string, unknown>) => Record<string, unknown>;

/**
 * The migrations a Bundle reader ships with: `migrations[n]` turns a version
 * `n` Bundle into a version `n + 1` one. Add one whenever SCHEMA_VERSION
 * goes up, so readers of published past Bundles can still compare them.
 */
export const migrations: Readonly<Record<number, Migration>> = {};

/**
 * Brings a Bundle read from a file up to the current `schemaVersion` by
 * running each migration in turn. Undefined when it is newer than this
 * Archidocs, a step is missing, or the result is not a valid Bundle; the
 * caller then rebuilds it or reports history as unavailable.
 */
export function migrateBundle(raw: unknown, chain: Readonly<Record<number, Migration>> = migrations, target = SCHEMA_VERSION): Bundle | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  let bundle = raw as Record<string, unknown>;
  let version = bundle.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version > target) return undefined;
  while (version < target) {
    const step = chain[version];
    if (!step) return undefined;
    bundle = { ...step(bundle), schemaVersion: version + 1 };
    version++;
  }
  const parsed = Bundle.safeParse(bundle);
  return parsed.success ? parsed.data : undefined;
}
