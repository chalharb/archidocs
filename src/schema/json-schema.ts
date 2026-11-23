import { z } from "zod";
import { AdrFrontmatter } from "./adr.ts";
import { ModelFile, ProjectFile, WorkspaceFile } from "./workspace.ts";

/**
 * JSON Schemas for authoring, generated from the zod types so editors and
 * `archidocs check` share one source. Point the `yaml-language-server`
 * `$schema` comment at the one matching the file.
 */
export function jsonSchemas(): Record<"workspace" | "project" | "model" | "adr", object> {
  const of = (title: string, schema: z.ZodType) => ({ title, ...z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) });
  return {
    workspace: of("Archidocs workspace.yaml", WorkspaceFile),
    project: of("Archidocs project.yaml", ProjectFile),
    model: of("Archidocs model file (any other *.yaml in a Project)", ModelFile),
    adr: of("Archidocs ADR frontmatter (<project>/adr/NNNN-slug.md)", AdrFrontmatter),
  };
}

/** A schema as written to `schemas/<name>.schema.json`. */
export const serializeJsonSchema = (schema: object): string => JSON.stringify(schema, null, 2) + "\n";
