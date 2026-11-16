import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { ErrorObject } from "ajv";
import type { FromSchema } from "json-schema-to-ts";
import { createJiti } from "jiti";
import { configSchema } from "./config-schema.js";
import type { Diagnostic } from "./types.js";

export type ArchidocsConfig = FromSchema<
  typeof configSchema,
  { keepDefaultedPropertiesOptional: true }
>;

/** Declares a config with full type checking and editor completion. */
export function defineConfig(config: ArchidocsConfig): ArchidocsConfig {
  return config;
}

// ajv-formats is CommonJS; the default import is callable at runtime but typed as a namespace.
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(configSchema);

function toPath(instancePath: string): string {
  return instancePath
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}

function describe(error: ErrorObject): { path: string; message: string } {
  const base = toPath(error.instancePath);
  const join = (key: string) => (base ? `${base}.${key}` : key);
  switch (error.keyword) {
    case "additionalProperties":
      return {
        path: join(String(error.params["additionalProperty"])),
        message: "is not a known option",
      };
    case "required":
      return { path: join(String(error.params["missingProperty"])), message: "is required" };
    case "oneOf":
      return { path: base, message: "must be a string or a non-empty array of strings" };
    case "enum":
      return {
        path: base,
        message: `must be one of: ${(error.params["allowedValues"] as unknown[]).join(", ")}`,
      };
    case "pattern":
      return { path: base, message: `must match the pattern ${String(error.params["pattern"])}` };
    case "format":
      return { path: base, message: `must be a valid ${String(error.params["format"])}` };
    case "type":
      return { path: base, message: `must be of type ${String(error.params["type"])}` };
    default:
      return { path: base, message: error.message ?? "is invalid" };
  }
}

/** Checks a value against the config schema and names each field at fault. */
export function validateConfig(value: unknown): Diagnostic[] {
  if (validateSchema(value)) return [];
  const errors = validateSchema.errors ?? [];
  const oneOfPaths = errors.filter((e) => e.keyword === "oneOf").map((e) => e.instancePath);
  return errors
    .filter(
      (e) =>
        e.keyword === "oneOf" ||
        !oneOfPaths.some((p) => e.instancePath === p || e.instancePath.startsWith(`${p}/`)),
    )
    .map((e) => ({ severity: "error" as const, ...describe(e) }));
}

export const CONFIG_FILE_NAMES = [
  "archidocs.config.ts",
  "archidocs.config.mts",
  "archidocs.config.js",
  "archidocs.config.mjs",
  "archidocs.config.json",
];

export function findConfigFile(dir: string): string | undefined {
  return CONFIG_FILE_NAMES.map((name) => path.join(dir, name)).find((file) => existsSync(file));
}

export type LoadedConfig =
  | { ok: true; file: string; dir: string; config: ArchidocsConfig }
  | { ok: false; file?: string; diagnostics: Diagnostic[] };

/** Loads and validates the config in `dir`, whether it is JSON or TypeScript. */
export async function loadConfig(dir: string): Promise<LoadedConfig> {
  const file = findConfigFile(dir);
  if (!file) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: "error",
          message: `No config file found in ${dir}. Run "archidocs init" to create one.`,
        },
      ],
    };
  }
  const name = path.basename(file);
  let value: unknown;
  try {
    if (file.endsWith(".json")) {
      value = JSON.parse(await readFile(file, "utf8"));
    } else {
      const jiti = createJiti(import.meta.url, { interopDefault: true });
      value = await jiti.import(file, { default: true });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      file,
      diagnostics: [{ severity: "error", file: name, message: `Could not read config: ${reason}` }],
    };
  }
  const diagnostics = validateConfig(value).map((d) => ({ ...d, file: name }));
  if (diagnostics.length > 0) return { ok: false, file, diagnostics };
  return { ok: true, file, dir, config: value as ArchidocsConfig };
}

export function formatDiagnostic(d: Diagnostic): string {
  const where = [d.file, d.path].filter(Boolean).join(": ");
  return `${d.severity === "error" ? "error" : "warning"}  ${where ? `${where} ` : ""}${d.message}`;
}
