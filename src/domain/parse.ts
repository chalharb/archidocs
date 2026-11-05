/**
 * Safe YAML parsing and per-resource validation (P0-03).
 *
 * - YAML 1.2 core schema only: no custom tags, no language-specific types,
 *   no code execution (SEC-05). Any non-core tag is rejected.
 * - Size, nesting-depth and alias-expansion limits (SEC-06).
 * - Multi-document files are supported; each document is one resource.
 * - Never throws for bad input: every problem becomes a diagnostic (FAIL-01).
 */
import {
  isAlias,
  isCollection,
  isMap,
  isNode,
  isPair,
  isScalar,
  LineCounter,
  parseAllDocuments,
  visit,
  type Document,
  type Node as YamlNode,
} from "yaml";
import type { z } from "zod";
import { diagnostic, type Diagnostic } from "./diagnostics";
import {
  API_VERSION,
  RESOURCE_KINDS,
  type ParsedResource,
  type Resource,
  type ResourceKind,
  type SourceRef,
} from "./resources";
import { RESOURCE_SCHEMAS } from "./schema/resource-schemas";
import { MIGRATIONS, MigrationError, migrateDocument, type Migration } from "./migrate";
import { suggest } from "./suggest";

export interface ParseLimits {
  /** Maximum file size in bytes. */
  maxBytes: number;
  /** Maximum nesting depth of mappings/sequences. */
  maxDepth: number;
  /** Maximum number of alias dereferences per document. */
  maxAliasCount: number;
  /** Maximum number of YAML documents in a single file. */
  maxDocuments: number;
}

export const DEFAULT_PARSE_LIMITS: ParseLimits = {
  maxBytes: 1024 * 1024,
  maxDepth: 32,
  maxAliasCount: 100,
  maxDocuments: 500,
};

const CORE_TAGS = new Set(
  ["str", "int", "float", "bool", "null", "map", "seq"].map((t) => `tag:yaml.org,2002:${t}`),
);

function syntaxMessage(message: string): string {
  return message.split("\n")[0]!.replace(/ at line \d+, column \d+:?$/, "");
}

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

type Path = Array<string | number>;

interface RawDocument {
  index: number;
  value: unknown;
  locate: (path: Path) => { line?: number; column?: number };
}

function positionOf(lineCounter: LineCounter, offset: number | undefined) {
  if (offset === undefined) return {};
  const { line, col } = lineCounter.linePos(offset);
  return { line, column: col };
}

/** Walk a YAML document to the deepest node that exists along `path`. */
function nodeRangeAt(doc: Document, path: Path): [number, number, number] | undefined {
  let node: unknown = doc.contents;
  let range = isNode(node) ? node.range : undefined;
  for (const segment of path) {
    if (!isCollection(node)) break;
    const next: unknown = node.get(segment, true);
    if (!isNode(next)) {
      // Missing value: try to point at the key itself.
      if (isMap(node)) {
        const pair = node.items.find((p) => isScalar(p.key) && p.key.value === segment);
        if (pair && isNode(pair.key)) range = pair.key.range ?? range;
      }
      break;
    }
    node = next;
    range = next.range ?? range;
  }
  return range ?? undefined;
}

function checkDocumentSafety(
  doc: Document,
  file: string,
  index: number,
  limits: ParseLimits,
  lineCounter: LineCounter,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let depthReported = false;
  visit(doc, (_key, node, path) => {
    if (isPair(node)) {
      const key = isScalar(node.key) ? node.key.value : undefined;
      if (typeof key === "string" && RESERVED_KEYS.has(key)) {
        diagnostics.push(
          diagnostic("error", "SCHEMA_INVALID_VALUE", `Reserved key '${key}' is not allowed`, {
            file,
            document: index,
            ...positionOf(
              lineCounter,
              node.key && isNode(node.key) ? node.key.range?.[0] : undefined,
            ),
            hint: "Rename this key.",
          }),
        );
      }
      return undefined;
    }
    if (!isNode(node) || isAlias(node)) return undefined; // e.g. the null key of a bare '?'
    const n: YamlNode = node;
    const tag = (n as { tag?: string }).tag;
    if (tag !== undefined && !CORE_TAGS.has(tag)) {
      diagnostics.push(
        diagnostic("error", "YAML_UNSAFE_TAG", `Unsupported YAML tag '${tag}'`, {
          file,
          document: index,
          ...positionOf(lineCounter, n.range?.[0]),
          hint: "Only plain YAML 1.2 core types (strings, numbers, booleans, null, maps, lists) are allowed.",
        }),
      );
      return visit.SKIP;
    }
    if (isCollection(n)) {
      const depth = path.filter((p) => isCollection(p)).length + 1;
      if (depth > limits.maxDepth) {
        if (!depthReported) {
          depthReported = true;
          diagnostics.push(
            diagnostic(
              "error",
              "YAML_TOO_DEEP",
              `YAML nesting exceeds the maximum depth of ${limits.maxDepth}`,
              { file, document: index, ...positionOf(lineCounter, n.range?.[0]) },
            ),
          );
        }
        return visit.BREAK;
      }
    }
    return undefined;
  });
  return diagnostics;
}

/** Parse YAML text into plain JS documents. Never throws. */
export function parseYamlDocuments(
  content: string,
  file: string,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS,
): { documents: RawDocument[]; diagnostics: Diagnostic[] } {
  const size = byteLength(content);
  if (size > limits.maxBytes) {
    return {
      documents: [],
      diagnostics: [
        diagnostic(
          "error",
          "YAML_TOO_LARGE",
          `File is ${size} bytes; the limit is ${limits.maxBytes} bytes`,
          { file, hint: "Split large files into several smaller resource files." },
        ),
      ],
    };
  }

  const lineCounter = new LineCounter();
  const diagnostics: Diagnostic[] = [];
  const documents: RawDocument[] = [];

  let parsed: Document[];
  try {
    const result = parseAllDocuments(content, {
      version: "1.2",
      schema: "core",
      merge: false,
      uniqueKeys: true,
      strict: true,
      prettyErrors: true,
      lineCounter,
    });
    parsed = Array.isArray(result) ? (result as Document[]) : [];
  } catch (err) {
    /* v8 ignore next 4 -- defensive: the yaml library reports errors instead of throwing */
    return {
      documents: [],
      diagnostics: [
        diagnostic("error", "YAML_SYNTAX", `Could not parse YAML: ${String(err)}`, { file }),
      ],
    };
  }

  if (parsed.length > limits.maxDocuments) {
    return {
      documents: [],
      diagnostics: [
        diagnostic(
          "error",
          "YAML_TOO_LARGE",
          `File contains ${parsed.length} YAML documents; the limit is ${limits.maxDocuments}`,
          { file },
        ),
      ],
    };
  }

  parsed.forEach((doc, index) => {
    if (doc.errors.length > 0) {
      for (const err of doc.errors) {
        const pos = err.linePos?.[0];
        diagnostics.push(
          diagnostic("error", "YAML_SYNTAX", syntaxMessage(err.message), {
            file,
            document: index,
            line: pos?.line,
            column: pos?.col,
          }),
        );
      }
      return;
    }
    // Empty document, e.g. a trailing '---'.
    if (doc.contents === null || (isScalar(doc.contents) && doc.contents.value === null)) return;

    const safety = checkDocumentSafety(doc, file, index, limits, lineCounter);
    if (safety.length > 0) {
      diagnostics.push(...safety);
      return;
    }

    let value: unknown;
    try {
      value = doc.toJS({ maxAliasCount: limits.maxAliasCount });
    } catch (err) {
      diagnostics.push(
        diagnostic(
          "error",
          "YAML_ALIAS_LIMIT",
          `YAML aliases could not be expanded safely: ${(err as Error).message}`,
          {
            file,
            document: index,
            hint: `Reduce anchor/alias use; at most ${limits.maxAliasCount} alias expansions are allowed.`,
          },
        ),
      );
      return;
    }
    documents.push({
      index,
      value,
      locate: (path) => positionOf(lineCounter, nodeRangeAt(doc, path)?.[0]),
    });
  });

  return { documents, diagnostics };
}

// ---------------------------------------------------------------------------
// Resource validation
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current;
}

interface ZodDefLike {
  type: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  element?: z.ZodType;
  valueType?: z.ZodType;
  getter?: () => z.ZodType;
}

function defOf(schema: z.ZodType): ZodDefLike {
  return (schema as unknown as { _zod: { def: ZodDefLike } })._zod.def;
}

/** Known keys of the strict object schema found at `path`, for "did you mean" hints. */
export function knownKeysAt(schema: z.ZodType, path: readonly PropertyKey[]): string[] {
  let current: z.ZodType | undefined = schema;
  const unwrap = (s: z.ZodType): z.ZodType => {
    let def = defOf(s);
    while (def.type === "optional" || def.type === "lazy") {
      s = def.type === "optional" ? def.innerType! : def.getter!();
      def = defOf(s);
    }
    return s;
  };
  for (const segment of path) {
    current = unwrap(current);
    const def = defOf(current);
    if (def.type === "object") current = def.shape?.[String(segment)];
    else if (def.type === "array") current = def.element;
    else if (def.type === "record") current = def.valueType;
    else return [];
    if (!current) return [];
  }
  const def = defOf(unwrap(current));
  return def.type === "object" ? Object.keys(def.shape ?? {}) : [];
}

function withNotes<T extends { diagnostics: Diagnostic[] }>(result: T, notes: Diagnostic[]): T {
  return { ...result, diagnostics: [...notes, ...result.diagnostics] };
}

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * Validate one parsed YAML document as an `archdocs/v1` resource.
 * Returns the typed resource, or diagnostics explaining why it is invalid.
 */
export function validateResource(
  value: unknown,
  source: Pick<SourceRef, "file" | "document">,
  locate: (path: Path) => { line?: number; column?: number } = () => ({}),
  migrations: readonly Migration[] = MIGRATIONS,
): { resource?: Resource; diagnostics: Diagnostic[] } {
  const where = (path: Path) => ({
    file: source.file,
    document: source.document,
    ...(path.length > 0 ? { path } : {}),
    ...locate(path),
  });

  if (!isPlainObject(value)) {
    return {
      diagnostics: [
        diagnostic("error", "YAML_NOT_A_MAPPING", "A resource document must be a YAML mapping", {
          ...where([]),
          hint: "Start the document with 'apiVersion: archdocs/v1' and 'kind: <Kind>'.",
        }),
      ],
    };
  }

  const { apiVersion } = value;
  if (apiVersion === undefined) {
    return {
      diagnostics: [
        diagnostic("error", "SCHEMA_MISSING_VERSION", "Missing required field 'apiVersion'", {
          ...where([]),
          hint: `Add 'apiVersion: ${API_VERSION}'.`,
        }),
      ],
    };
  }
  // Older versions are upgraded in memory when a migration path exists (SCHEMA-10).
  const notes: Diagnostic[] = [];
  if (apiVersion !== API_VERSION) {
    let migrated: Record<string, unknown> | null = null;
    try {
      migrated = migrateDocument(value, migrations);
    } catch (err) {
      const e = err as MigrationError;
      return {
        diagnostics: [
          diagnostic("error", "SCHEMA_MIGRATION_FAILED", e.message, {
            ...where(["apiVersion"]),
            hint: "The document was not loaded. Update it to the current schema by hand or fix the migration.",
          }),
        ],
      };
    }
    if (migrated) {
      notes.push(
        diagnostic(
          "info",
          "SCHEMA_MIGRATED",
          `Upgraded from '${String(apiVersion)}' to '${API_VERSION}' in memory`,
          {
            ...where(["apiVersion"]),
            hint: `Update the file to '${API_VERSION}' to skip the migration.`,
          },
        ),
      );
      return withNotes(validateResource(migrated, source, locate, migrations), notes);
    }
    return {
      diagnostics: [
        diagnostic(
          "error",
          "SCHEMA_UNSUPPORTED_VERSION",
          `Unsupported schema version '${String(apiVersion)}'`,
          {
            ...where(["apiVersion"]),
            hint: `This application supports '${API_VERSION}' only.`,
          },
        ),
      ],
    };
  }
  const { kind } = value;
  if (!isResourceKind(kind)) {
    const match = typeof kind === "string" ? suggest(kind, RESOURCE_KINDS) : undefined;
    return {
      diagnostics: [
        diagnostic(
          "error",
          "SCHEMA_UNKNOWN_KIND",
          kind === undefined
            ? "Missing required field 'kind'"
            : `Unknown resource kind '${String(kind)}'`,
          {
            ...where(kind === undefined ? [] : ["kind"]),
            hint: match ? `Did you mean '${match}'?` : `Valid kinds: ${RESOURCE_KINDS.join(", ")}.`,
          },
        ),
      ],
    };
  }

  const schema = RESOURCE_SCHEMAS[kind];
  const result = schema.safeParse(value);
  if (result.success) return { resource: result.data as Resource, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];
  for (const issue of result.error.issues) {
    const path = issue.path.map((p) => (typeof p === "symbol" ? String(p) : p));
    if (issue.code === "unrecognized_keys") {
      const known = knownKeysAt(schema, path);
      for (const key of issue.keys) {
        const match = suggest(key, known);
        diagnostics.push(
          diagnostic("error", "SCHEMA_UNKNOWN_FIELD", `Unknown field '${key}' in ${kind}`, {
            ...where([...path, key]),
            hint: match
              ? `Did you mean '${match}'?`
              : known.length > 0
                ? `Allowed fields: ${known.join(", ")}. Put custom metadata under 'properties'.`
                : "Remove this field.",
          }),
        );
      }
    } else if (issue.code === "invalid_type" && valueAt(value, path) === undefined) {
      const field = path[path.length - 1];
      diagnostics.push(
        diagnostic(
          "error",
          "SCHEMA_REQUIRED_FIELD",
          `Missing required field '${String(field)}' in ${kind}`,
          {
            ...where(path.slice(0, -1)),
            path,
            hint: `Add '${String(field)}' (expected ${issue.expected}).`,
          },
        ),
      );
    } else {
      diagnostics.push(
        diagnostic(
          "error",
          "SCHEMA_INVALID_VALUE",
          `Invalid value in ${kind}: ${issue.message}`,
          where(path),
        ),
      );
    }
  }
  return { diagnostics };
}

/** Parse a YAML file into validated resources. Never throws. */
export function parseResources(
  content: string,
  file: string,
  limits: ParseLimits = DEFAULT_PARSE_LIMITS,
  migrations: readonly Migration[] = MIGRATIONS,
): { resources: ParsedResource[]; diagnostics: Diagnostic[] } {
  const { documents, diagnostics } = parseYamlDocuments(content, file, limits);
  const resources: ParsedResource[] = [];
  for (const doc of documents) {
    const source = { file, document: doc.index };
    const result = validateResource(doc.value, source, doc.locate, migrations);
    diagnostics.push(...result.diagnostics);
    if (result.resource)
      resources.push({ resource: result.resource, source: { ...source, path: [] } });
  }
  return { resources, diagnostics };
}
