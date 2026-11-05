/** Test helpers for building resources and models from YAML snippets. */
import { normalize } from "@/domain/normalize";
import { parseResources } from "@/domain/parse";
import type { ParsedResource } from "@/domain/resources";
import { validateModel } from "@/domain/validate";

/** Prefix a YAML body with the archdocs/v1 header. */
export function res(kind: string, body: string): string {
  return `apiVersion: archdocs/v1\nkind: ${kind}\n${body.trim()}\n`;
}

export function docs(...documents: string[]): string {
  return documents.join("---\n");
}

/** Parse several files (name -> YAML) and fail loudly on parse diagnostics. */
export function parseFiles(files: Record<string, string>): ParsedResource[] {
  const out: ParsedResource[] = [];
  for (const [file, content] of Object.entries(files)) {
    const { resources, diagnostics } = parseResources(content, file);
    if (diagnostics.length > 0) {
      throw new Error(
        `Unexpected parse diagnostics in ${file}: ${JSON.stringify(diagnostics, null, 2)}`,
      );
    }
    out.push(...resources);
  }
  return out;
}

export function buildModel(files: Record<string, string>) {
  const { model, diagnostics } = normalize(parseFiles(files));
  return { model, diagnostics: [...diagnostics, ...validateModel(model)] };
}

export const BASE_TYPES = docs(
  res("EntityType", "id: actor\nname: Actor"),
  res("EntityType", "id: person\nname: Person\nextends: actor"),
  res("EntityType", "id: software-system\nname: Software System"),
  res("EntityType", "id: container\nname: Container"),
  res("EntityType", "id: database\nname: Database\nextends: container"),
  res("RelationshipType", "id: uses\nname: Uses"),
  res("RelationshipType", "id: reads\nname: Reads from\nsources: [container]\ntargets: [database]"),
  res("RelationshipType", "id: reads-fast\nname: Reads quickly\nextends: reads"),
);
