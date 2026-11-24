/**
 * Field tables from JSON Schemas: each field's path, type, whether it is
 * required, and what the schema says about it. Used for the Model YAML
 * reference (`schemas/*.schema.json`) and the MCP tools' inputs and outputs.
 */
import { table, text } from "./page.ts";

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  propertyNames?: JsonSchema;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  default?: unknown;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  title?: string;
}

export interface FieldRow {
  path: string;
  type: string;
  required: boolean;
  notes: string;
}

/**
 * The rows for a schema's fields, depth first. A map keyed by id shows as
 * `<id>` in the path, a list's items as `[]`. A `$ref` seen higher up the
 * same path is named, not expanded again.
 */
export function fieldRows(schema: JsonSchema, { root = schema, prefix = "", maxDepth = Infinity }: { root?: JsonSchema; prefix?: string; maxDepth?: number } = {}): FieldRow[] {
  const rows: FieldRow[] = [];
  const walk = (node: JsonSchema, path: string, depth: number, seen: readonly string[]) => {
    const { schema: s, ref } = deref(node, root);
    if (ref && seen.includes(ref)) return;
    const nextSeen = ref ? [...seen, ref] : seen;
    if (depth >= maxDepth) return;
    const variants = s.anyOf ?? s.oneOf;
    if (variants) {
      for (const v of variants) {
        const d = deref(v, root).schema;
        if (d.properties || d.additionalProperties || d.items) walk(v, path, depth, nextSeen);
      }
      return;
    }
    for (const [key, child] of Object.entries(s.properties ?? {})) {
      const childPath = path ? `${path}.${key}` : key;
      rows.push(row(child, childPath, s.required?.includes(key) ?? false, root));
      walk(child, childPath, depth + 1, nextSeen);
    }
    if (typeof s.additionalProperties === "object") {
      const childPath = `${path ? `${path}.` : ""}<id>`;
      const child = s.additionalProperties;
      const d = deref(child, root).schema;
      if (d.properties || d.anyOf || d.oneOf) walk(child, childPath, depth + 1, nextSeen);
    }
    if (s.items) walk(s.items, `${path}[]`, depth + 1, nextSeen);
  };
  walk(schema, prefix, 0, []);
  return rows;
}

export const fieldTable = (rows: readonly FieldRow[]): string =>
  table(
    ["Field", "Type", "Required", "Notes"],
    rows.map((r) => [`\`${r.path}\``, r.type, r.required ? "yes" : "", text(r.notes)]),
  );

function row(node: JsonSchema, path: string, required: boolean, root: JsonSchema): FieldRow {
  const s = deref(node, root).schema;
  const notes = [
    node.description ?? s.description,
    s.default !== undefined && `Default: \`${JSON.stringify(s.default)}\`.`,
    s.format && `Format: ${s.format}.`,
    s.minimum !== undefined && `At least ${s.minimum}.`,
    s.maximum !== undefined && `At most ${s.maximum}.`,
    s.minItems !== undefined && s.minItems > 0 && `At least ${s.minItems} item${s.minItems === 1 ? "" : "s"}.`,
  ].filter((n): n is string => typeof n === "string" && n !== "");
  return { path, type: typeName(node, root), required, notes: notes.map((n) => (/[.!?]$/.test(n) ? n : `${n}.`)).join(" ") };
}

/** A schema's type in words: `string`, `"app" \| "datastore"`, `list of string`, `map of id → object`. */
export function typeName(node: JsonSchema, root: JsonSchema): string {
  const { schema: s, ref } = deref(node, root);
  if (ref && !s.type && !s.enum) return ref;
  if (s.const !== undefined) return `\`${JSON.stringify(s.const)}\``;
  if (s.enum) return s.enum.map((v) => `\`${JSON.stringify(v)}\``).join(" or ");
  const variants = s.anyOf ?? s.oneOf;
  if (variants) return [...new Set(variants.map((v) => typeName(v, root)))].join(" or ");
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const named = types.map((t) => {
    if (t === "array") return s.items ? `list of ${typeName(s.items, root)}` : "list";
    if (t === "object" && !s.properties && typeof s.additionalProperties === "object") return `map of id → ${typeName(s.additionalProperties, root)}`;
    if (t === "string" && ref) return ref;
    return t;
  });
  return named.join(" or ") || (ref ?? "any");
}

/** Follows a local `$ref` (`#/$defs/Target`), returning the target and its name. */
function deref(node: JsonSchema, root: JsonSchema): { schema: JsonSchema; ref?: string } {
  if (!node.$ref) return { schema: node };
  const name = node.$ref.replace(/^#\/(?:\$defs|definitions)\//, "");
  const target = root.$defs?.[name];
  if (!target) throw new Error(`Unresolved $ref ${node.$ref}`);
  return { schema: target, ref: name };
}
