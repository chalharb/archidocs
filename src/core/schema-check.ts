import type { z } from "zod";
import type { ParsedYaml, Position } from "./yaml.ts";
import { didYouMean } from "./suggest.ts";

export type SchemaRule = "unknown-field" | "missing-field" | "invalid-value";

export interface SchemaFinding extends Position {
  rule: SchemaRule;
  message: string;
}

/**
 * Checks `data` (found at `basePath` in a parsed file) against a zod schema
 * and turns each zod issue into a finding for one of the three schema rules,
 * positioned at the offending key or value.
 */
export function checkSchema(
  schema: z.ZodType,
  data: unknown,
  parsed: ParsedYaml,
  basePath: readonly PropertyKey[] = [],
): SchemaFinding[] {
  const result = schema.safeParse(data);
  if (result.success) return [];
  const findings: SchemaFinding[] = [];
  for (const issue of result.error.issues) {
    const path = [...basePath, ...issue.path];
    if (issue.code === "unrecognized_keys") {
      const allowed = keysOf(schemaAt(schema, issue.path));
      for (const key of issue.keys) {
        findings.push({
          rule: "unknown-field",
          ...parsed.positionOf([...path, key], { key: true }),
          message: `Unknown field "${key}"${didYouMean(key, allowed)}`,
        });
      }
    } else if (issue.code === "invalid_type" && valueAt(data, issue.path) === undefined) {
      const field = String(issue.path.at(-1));
      findings.push({
        rule: "missing-field",
        ...parsed.positionOf(path.slice(0, -1), { key: true }),
        message: `Missing required field "${field}"`,
      });
    } else {
      const where = issue.path.length > 0 ? `"${issue.path.join(".")}"` : "file";
      const keyIssue = issue.code === "invalid_key";
      findings.push({
        rule: "invalid-value",
        ...parsed.positionOf(path, { key: keyIssue }),
        message: `Invalid value for ${where}: ${issue.message.replace(/^Invalid (input|option): /, "")}`,
      });
    }
  }
  return findings;
}

function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  let cur = data;
  for (const segment of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[segment];
  }
  return cur;
}

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  valueType?: z.ZodType;
  element?: z.ZodType;
}

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

function unwrap(schema: z.ZodType): z.ZodType {
  let def = defOf(schema);
  while ((def.type === "optional" || def.type === "nullable" || def.type === "default") && def.innerType) {
    schema = def.innerType;
    def = defOf(schema);
  }
  return schema;
}

/** The sub-schema that validates the value at `path`. */
function schemaAt(schema: z.ZodType, path: readonly PropertyKey[]): z.ZodType | undefined {
  let cur: z.ZodType | undefined = unwrap(schema);
  for (const segment of path) {
    if (!cur) return undefined;
    const def = defOf(cur);
    const next: z.ZodType | undefined =
      def.type === "object" ? def.shape?.[String(segment)] : def.type === "record" ? def.valueType : def.type === "array" ? def.element : undefined;
    cur = next && unwrap(next);
  }
  return cur;
}

function keysOf(schema: z.ZodType | undefined): string[] {
  if (!schema) return [];
  const def = defOf(schema);
  return def.type === "object" && def.shape ? Object.keys(def.shape) : [];
}
