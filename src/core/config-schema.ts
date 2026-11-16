/**
 * The single source of truth for the workspace config. The JSON Schema shipped
 * with the package and the `ArchidocsConfig` type are both derived from this
 * constant, so they cannot drift.
 */
export const configSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Archidocs config",
  type: "object",
  additionalProperties: false,
  required: ["name", "model"],
  properties: {
    $schema: { type: "string" },
    name: {
      description: "Workspace id, used in URLs.",
      type: "string",
      pattern: "^[a-z0-9][a-z0-9-]*$",
    },
    title: {
      description: "Display name. Defaults to name.",
      type: "string",
    },
    model: {
      description: "Glob or globs for the CALM architecture files, relative to this file.",
      oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, minItems: 1 }],
    },
    decisions: {
      description: "Folder of decision records.",
      type: "string",
      default: "docs/adr",
    },
    notation: {
      description: "Built-in notation name.",
      enum: ["c4"],
      default: "c4",
    },
    repository: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: {
        url: { type: "string", format: "uri" },
        branch: { type: "string", default: "main" },
      },
    },
    site: {
      type: "object",
      additionalProperties: false,
      properties: {
        base: {
          description: "Path the site is served under.",
          type: "string",
          pattern: "^/",
          default: "/",
        },
      },
    },
    checks: {
      description: "Model health rules from validate. Each is off, warn or error.",
      type: "object",
      additionalProperties: false,
      properties: {
        elementInNoView: { $ref: "#/$defs/level" },
        elementWithoutOwner: { $ref: "#/$defs/level" },
        elementWithoutRelationships: { $ref: "#/$defs/level" },
        decisionRefersToMissingId: { $ref: "#/$defs/level" },
        viewTooLarge: { $ref: "#/$defs/level" },
        maxElementsPerView: { type: "integer", minimum: 1, default: 30 },
      },
    },
  },
  $defs: {
    level: { enum: ["off", "warn", "error"], default: "warn" },
  },
} as const;
