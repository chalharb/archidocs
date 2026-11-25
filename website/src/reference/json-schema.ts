/**
 * Field tables from JSON Schemas: each field's path, type, whether it is
 * required, and what the schema says about it. The MCP tools' inputs and
 * outputs use `fieldSections` and `fieldTable`: one table, and one more for
 * each variant of a union. The Model YAML reference (`schemas/*.schema.json`) uses
 * `describedRows` and `describedShape`, which list a shape used in several
 * places (a `$defs` entry) once and link to it from each place it is used.
 */
import { blocks, table, text } from "./page.ts";

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
  maxItems?: number;
  title?: string;
}

export interface FieldRow {
  path: string;
  type: string;
  required: boolean;
  notes: string;
}

/** A table's worth of rows: the fields always there, or those of one variant of a union. */
export interface FieldSection {
  /** For a variant: "When `element.kind` is `service`". */
  when?: string;
  rows: FieldRow[];
}

/**
 * The rows for a schema's fields, depth first. A map keyed by id shows as
 * `<id>` in the path, a list's items as `[]`, and a `$ref` seen higher up
 * the same path is named, not expanded again. A union of objects is split: the fields every variant has, defined the same
 * way, stay in the table they are met in, and each variant's other fields get
 * a section of their own. A variant is named by the field whose constant
 * tells the variants apart (`kind`), or else by the required fields only it
 * has. So no table lists a field twice.
 */
export function fieldSections(schema: JsonSchema, { root = schema, maxDepth = Infinity }: { root?: JsonSchema; maxDepth?: number } = {}): FieldSection[] {
  const sections: FieldSection[] = [];
  const open = (when?: string): FieldSection => {
    const section: FieldSection = when === undefined ? { rows: [] } : { when, rows: [] };
    sections.push(section);
    return section;
  };
  const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

  const fields = (s: JsonSchema, keys: readonly string[], path: string, depth: number, seen: readonly string[], into: FieldSection) => {
    for (const key of keys) {
      const child = s.properties![key]!;
      const childPath = join(path, key);
      into.rows.push(row(child, childPath, s.required?.includes(key) ?? false, root));
      walk(child, childPath, depth + 1, seen, into);
    }
  };

  const split = (objects: JsonSchema[], path: string, depth: number, seen: readonly string[], into: FieldSection) => {
    const shared = sharedProperties(objects);
    const tag = discriminator(objects);
    const first = objects[0]!;
    for (const key of Object.keys(first.properties!)) {
      if (key === tag) {
        const values = objects.map((o) => constOf(o.properties![key]!));
        const required = objects.every((o) => o.required?.includes(key));
        into.rows.push({ ...row(first.properties![key]!, join(path, key), required, root), type: values.map((v) => `\`${JSON.stringify(v)}\``).join(" or ") });
      } else if (shared.includes(key)) fields(first, [key], path, depth, seen, into);
    }
    const subject = path === "" ? "the result" : `\`${path}\``;
    for (const o of objects) {
      const own = (o.required ?? []).filter((k) => !objects.some((other) => other !== o && other.properties?.[k]));
      const label = tag !== undefined ? `When \`${join(path, tag)}\` is \`${String(constOf(o.properties![tag]!))}\`` : `When ${subject} has ${own.map((k) => `\`${k}\``).join(" and ")}`;
      const section = open(into.when ? `${into.when}, and ${label.replace(/^When /, "")}` : label);
      fields(o, Object.keys(o.properties!).filter((k) => k !== tag && !shared.includes(k)), path, depth, seen, section);
    }
  };

  const walk = (node: JsonSchema, path: string, depth: number, seen: readonly string[], into: FieldSection) => {
    const { schema: s, ref } = deref(node, root);
    if (ref && seen.includes(ref)) return;
    const nextSeen = ref ? [...seen, ref] : seen;
    if (depth >= maxDepth) return;
    const variants = s.anyOf ?? s.oneOf;
    if (variants) {
      const objects = variants.map((v) => deref(v, root).schema).filter((d) => d.properties);
      if (objects.length >= 2) return split(objects, path, depth, nextSeen, into);
      for (const v of variants) {
        const d = deref(v, root).schema;
        if (d.properties || d.additionalProperties || d.items) walk(v, path, depth, nextSeen, into);
      }
      return;
    }
    fields(s, Object.keys(s.properties ?? {}), path, depth, nextSeen, into);
    if (typeof s.additionalProperties === "object") {
      const d = deref(s.additionalProperties, root).schema;
      if (d.properties || d.anyOf || d.oneOf) walk(s.additionalProperties, join(path, "<id>"), depth + 1, nextSeen, into);
    }
    if (s.items) walk(s.items, `${path}[]`, depth + 1, nextSeen, into);
  };

  walk(schema, "", 0, [], open());
  return sections;
}

/** A schema's constant: its `const`, or the one value of its `enum`. */
const constOf = (s: JsonSchema): unknown => (s.const !== undefined ? s.const : s.enum?.length === 1 ? s.enum[0] : undefined);

/** The property whose constant differs in every one of the objects, if there is one. */
function discriminator(objects: readonly JsonSchema[]): string | undefined {
  return Object.keys(objects[0]!.properties ?? {}).find((key) => {
    const values = objects.map((o) => (o.properties?.[key] ? constOf(o.properties[key]) : undefined));
    return values.every((v) => v !== undefined) && new Set(values.map((v) => JSON.stringify(v))).size === values.length;
  });
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

/** A shared shape's name, and where the reference lists its fields. */
export interface ShapeLink {
  label: string;
  href: string;
}

export interface DescribeOptions {
  /** The schema whose `$defs` the `$ref`s resolve against. */
  root: JsonSchema;
  /** Put before every path, as `services.<id>`. */
  prefix?: string;
  /** Where each shared shape (a `$defs` entry) is documented. A shape listed here is named and linked where it is used, not expanded there. */
  shapes?: Readonly<Record<string, ShapeLink>>;
  /** The one shape this table is the home of: expanded where it is first met, and linked from any use deeper inside it. */
  expand?: string | undefined;
  /** Properties of the `expand` shape to leave out because they are documented elsewhere. */
  omit?: readonly string[];
  /** What to call a string that must match a pattern: `{ "^[a-z0-9][a-z0-9-]*$": "id" }`. */
  patterns?: Readonly<Record<string, string>>;
  /** Collects each named type (`id`, `URL`) a row uses, so a page can explain it once. */
  used?: Set<string>;
}

export interface DescribedRow {
  path: string;
  /** Markdown: it may link a shared shape. */
  type: string;
  required: boolean;
  /** Plain text; empty when the field has no default. */
  default: string;
  /** Plain text. */
  description: string;
}

/** One alternative of a shape that is a union: an id, or one of several maps. */
export interface Variant {
  /** Markdown: `{element}` for a map with that required key, or the type's name. */
  label: string;
  description: string;
  rows: DescribedRow[];
  /** Set when the alternative is itself a shared shape, listed in its own place. */
  shape?: ShapeLink;
}

/**
 * The rows for a schema's fields, depth first, with a row for each entry of a
 * map (`<id>`) or list (`[]`) whose fields are listed here. A shared shape is
 * linked, not expanded, except the `expand` shape where it is first met.
 */
export function describedRows(schema: JsonSchema, options: DescribeOptions): DescribedRow[] {
  const { root, prefix = "", shapes = {}, expand, omit = [] } = options;
  const rows: DescribedRow[] = [];
  /** A `$ref` that is not followed: one already open higher up the path, or a shared shape listed elsewhere. */
  const closed = (ref: string | undefined, inside: boolean, seen: readonly string[]) => ref !== undefined && (seen.includes(ref) || (ref in shapes && (ref !== expand || inside)));
  const walk = (node: JsonSchema, path: string, inside: boolean, seen: readonly string[]) => {
    const { schema: s, ref } = deref(node, root);
    if (closed(ref, inside, seen)) return;
    const home = ref !== undefined && ref === expand;
    const within = inside || home;
    const nextSeen = ref ? [...seen, ref] : seen;
    for (const v of s.anyOf ?? s.oneOf ?? []) if (hasFields(deref(v, root).schema)) walk(v, path, within, nextSeen);
    for (const [key, child] of Object.entries(s.properties ?? {})) {
      if (home && omit.includes(key)) continue;
      const childPath = path ? `${path}.${key}` : key;
      rows.push(describedRow(child, childPath, s.required?.includes(key) ?? false, within, options));
      walk(child, childPath, within, nextSeen);
    }
    const entries: [JsonSchema | boolean | undefined, string][] = [
      [s.additionalProperties, `${path ? `${path}.` : ""}<id>`],
      [s.items, `${path}[]`],
    ];
    for (const [entry, entryPath] of entries) {
      if (typeof entry !== "object") continue;
      const e = deref(entry, root);
      // An entry whose fields follow gets a row of its own, saying what one entry is.
      if (e.schema.properties && !closed(e.ref, within, nextSeen)) rows.push(describedRow(entry, entryPath, false, within, options));
      walk(entry, entryPath, within, nextSeen);
    }
  };
  walk(schema, prefix, false, []);
  return rows;
}

export const describedTable = (rows: readonly DescribedRow[]): string =>
  table(
    ["Field", "Type", "Required", "Default", "Description"],
    rows.map((r) => [`\`${r.path}\``, r.type, r.required ? "yes" : "", text(r.default), text(r.description)]),
  );

/**
 * The alternatives of a shape that is a union, or undefined for any other
 * shape. A map alternative carries its fields; a shared shape among them is
 * linked instead.
 */
export function variants(schema: JsonSchema, options: DescribeOptions): Variant[] | undefined {
  const { root, shapes = {} } = options;
  const union = deref(schema, root).schema;
  return (union.anyOf ?? union.oneOf)?.map((v): Variant => {
    const { schema: s, ref } = deref(v, root);
    const description = v.description ?? s.description ?? "";
    const keys = s.required?.length ? s.required : Object.keys(s.properties ?? {});
    const label = s.properties ? `\`{${keys.join(", ")}}\`` : describedType(v, false, options);
    const shape = ref === undefined ? undefined : shapes[ref];
    if (shape) return { label, description, rows: [], shape };
    return { label, description, rows: s.properties ? describedRows(s, { ...options, prefix: "", expand: undefined, omit: [] }) : [] };
  });
}

/**
 * A shape's fields as Markdown, with paths that start at the shape: one
 * table, or for a union each alternative in turn with a table of its own.
 */
export function describedShape(schema: JsonSchema, options: DescribeOptions): string {
  const alternatives = variants(schema, options);
  if (!alternatives) return describedTable(describedRows(schema, { ...options, prefix: "", expand: undefined, omit: [] }));
  return blocks(
    ...alternatives.flatMap((v) => [
      `**${v.label}**: ${text(v.description)}${v.shape ? ` Its fields are under [${v.shape.label}](${v.shape.href}).` : ""}`,
      v.rows.length > 0 && describedTable(v.rows),
    ]),
  );
}

/**
 * The shared shapes a schema uses, in the order it first uses them, each
 * followed by the shapes it uses in turn. `enter` says which shapes to look
 * inside; the others are named and left closed.
 */
export function usedShapes(schema: JsonSchema, root: JsonSchema, enter: (name: string) => boolean = () => true): string[] {
  const found = new Set<string>();
  const walk = (node: JsonSchema) => {
    const { schema: s, ref } = deref(node, root);
    if (ref !== undefined) {
      if (found.has(ref)) return;
      found.add(ref);
      if (!enter(ref)) return;
    }
    for (const child of [...Object.values(s.properties ?? {}), ...(s.anyOf ?? []), ...(s.oneOf ?? []), ...(s.allOf ?? []), s.items, s.additionalProperties]) {
      if (typeof child === "object") walk(child);
    }
  };
  walk(schema);
  return [...found];
}

/** The properties every one of the shapes has, defined and required the same way in each. */
export function sharedProperties(shapes: readonly JsonSchema[]): string[] {
  const [first, ...rest] = shapes;
  if (!first) return [];
  const required = (s: JsonSchema, key: string) => s.required?.includes(key) ?? false;
  return Object.entries(first.properties ?? {})
    .filter(([key, value]) => rest.every((s) => JSON.stringify(s.properties?.[key]) === JSON.stringify(value) && required(s, key) === required(first, key)))
    .map(([key]) => key);
}

/**
 * A description that closes with a `Default: ….` sentence, split into the
 * two. Schema descriptions state a default this way, so an editor's hover
 * shows it and the reference gives it a column.
 */
export function splitDefault(description: string): { description: string; default: string } {
  const match = /^(.*?)\s*\bDefault: (.+?)\.?$/s.exec(description.trim());
  return match ? { description: match[1]!, default: match[2]! } : { description: description.trim(), default: "" };
}

function describedRow(node: JsonSchema, path: string, required: boolean, inside: boolean, options: DescribeOptions): DescribedRow {
  const s = deref(node, options.root).schema;
  const stated = splitDefault(node.description ?? s.description ?? "");
  // A pattern the page has a name for, or that only spells out a named format, is already said by the type.
  const unnamed = s.pattern !== undefined && options.patterns?.[s.pattern] === undefined && FORMATS[s.format ?? ""] === undefined ? s.pattern : undefined;
  const limits = [
    unnamed !== undefined && `Must match \`${unnamed}\`.`,
    s.maximum !== undefined && s.maximum < Number.MAX_SAFE_INTEGER && `At most ${s.maximum}.`,
    s.minItems !== undefined && s.minItems > 0 && `At least ${s.minItems} item${s.minItems === 1 ? "" : "s"}.`,
    s.maxItems !== undefined && `At most ${s.maxItems} item${s.maxItems === 1 ? "" : "s"}.`,
  ].filter((n): n is string => typeof n === "string");
  const sentence = stated.description === "" || /[.!?]$/.test(stated.description) ? stated.description : `${stated.description}.`;
  return {
    path,
    type: describedType(node, inside, options),
    required,
    default: s.default !== undefined ? literal(s.default) : stated.default,
    description: [sentence, ...limits].filter((n) => n !== "").join(" "),
  };
}

/**
 * A schema's type as someone writing YAML reads it: `sync` or `async`,
 * `list of reference`, `map of id → [Service](…)`, `integer ≥ 1`. A string
 * that must match a named pattern takes that name; one with a format, the
 * format's (`URL`, `date`).
 */
function describedType(node: JsonSchema, inside: boolean, options: DescribeOptions): string {
  const { root, shapes = {}, expand, patterns = {}, used } = options;
  const named = (name: string) => {
    used?.add(name);
    return name;
  };
  const of = (n: JsonSchema): string => {
    const { schema: s, ref } = deref(n, root);
    const shape = ref === undefined ? undefined : shapes[ref];
    if (shape) return ref === expand && !inside ? shape.label : `[${shape.label}](${shape.href})`;
    if (ref !== undefined && s.title) return s.title;
    if (s.const !== undefined) return literal(s.const);
    if (s.enum) return oneOf(s.enum.map(literal));
    const alternatives = s.anyOf ?? s.oneOf;
    if (alternatives) return [...new Set(alternatives.map(of))].join(" or ");
    const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
    const names = types.map((t) => {
      if (t === "array") return s.items ? `list of ${of(s.items)}` : "list";
      if (t === "object" && !s.properties && typeof s.additionalProperties === "object") {
        const key = s.propertyNames?.pattern === undefined ? undefined : patterns[s.propertyNames.pattern];
        return `map of ${key === undefined ? "key" : named(key)} → ${of(s.additionalProperties)}`;
      }
      if (t === "string" && s.pattern !== undefined && patterns[s.pattern] !== undefined) return named(patterns[s.pattern]!);
      if (t === "string" && s.format !== undefined) return named(FORMATS[s.format] ?? `string (${s.format})`);
      if ((t === "integer" || t === "number") && s.minimum !== undefined) return `${t} ≥ ${s.minimum}`;
      return t;
    });
    return names.join(" or ") || (ref ?? "any");
  };
  return of(node);
}

/** What the reference calls a string format. */
const FORMATS: Record<string, string> = { uri: "URL", date: "date" };

/** A value as it is written in YAML, in a code span: `app`, `false`, `4`. */
const literal = (value: unknown): string => `\`${typeof value === "string" ? value : JSON.stringify(value)}\``;

/** `a`, `b` or `c`. */
const oneOf = (items: readonly string[]): string => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)!}`);

/** Whether a schema has fields or entries of its own to list. */
const hasFields = (s: JsonSchema): boolean => s.properties !== undefined || typeof s.additionalProperties === "object" || s.items !== undefined;
