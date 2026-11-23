import { Ref } from "../schema/workspace.ts";
import type { Project } from "./model.ts";

/** A well-formed reference written in `project`, as a qualified id; undefined when malformed or the Project has no id. */
export function qualify(ref: unknown, project: Project): string | undefined {
  if (!Ref.safeParse(ref).success) return undefined;
  const text = ref as string;
  if (text.includes(":")) return text;
  return project.id === undefined ? undefined : `${project.id}:${text}`;
}

/** Indexes declarations by qualified id, keeping the first of each and skipping Projects without a usable id. */
export function indexByQualifiedId<T extends { id: string; project: Project }>(decls: readonly T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const d of decls) {
    if (d.project.id === undefined || d.project.duplicateOf) continue;
    const key = `${d.project.id}:${d.id}`;
    if (!index.has(key)) index.set(key, d);
  }
  return index;
}
