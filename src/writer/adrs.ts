import { join } from "node:path";
import { fillTemplate, MADR_MINIMAL, PROJECT_TEMPLATE, splitFrontmatter, WORKSPACE_TEMPLATE } from "../core/adr.ts";
import type { LoadedWorkspace } from "../core/model.ts";
import { qualify } from "../core/refs.ts";
import { AdrRef } from "../schema/adr.ts";
import { YamlFile } from "./document.ts";
import { fail, findProject, written, type Edit, type Planned, type SourceRef } from "./edit.ts";

export type AdrRequest = {
  op: "propose-adr";
  project: string;
  title: string;
  elements?: string[];
  views?: string[];
  supersedes?: string[];
  body?: string;
};

/**
 * Writes a Proposed ADR as `<project>/adr/NNNN-slug.md`, taking the next free
 * number in the Project. With no `body`, the Project's `adr/template.md` is
 * filled, else the Workspace's `adr-template.md`, else MADR minimal. The
 * frontmatter always gets `status: proposed`, today's date and the links
 * given; links are checked when the Workspace is re-validated.
 */
export async function proposeAdr(edit: Edit, request: AdrRequest): Promise<Planned> {
  const project = findProject(edit, request.project);
  if ("ok" in project) return project;
  const title = request.title.trim();
  if (!title) return fail("invalid_input", "title must not be empty.");

  const links: Record<"elements" | "views" | "supersedes", string[]> = { elements: [], views: [], supersedes: [] };
  for (const field of ["elements", "views"] as const) {
    for (const ref of request[field] ?? []) {
      const w = written(ref, project, field);
      if (!w.ok) return w;
      links[field].push(w.ref);
    }
  }
  for (const ref of request.supersedes ?? []) {
    if (!AdrRef.safeParse(ref).success) return fail("invalid_input", `supersedes "${ref}" must be an ADR number (NNNN), or project:NNNN for one in another Project.`);
    links.supersedes.push(ref.startsWith(`${project.id}:`) ? ref.slice(project.id!.length + 1) : ref);
  }

  const taken = edit.ws.adrs.filter((a) => a.project === project && a.number !== undefined).map((a) => Number(a.number));
  const number = String(Math.max(0, ...taken) + 1).padStart(4, "0");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") || "decision";
  const folder = join(edit.repoRoot, ...project.folder.split("/"), "adr");
  const date = new Date().toISOString().slice(0, 10);

  let text: string;
  if (request.body !== undefined) {
    const body = request.body.trimEnd() + "\n";
    text = /^# /m.test(body) ? body : `# ${title}\n\n${body}`;
  } else {
    const template = (await edit.read(join(folder, PROJECT_TEMPLATE))) ?? (await edit.read(join(edit.root, WORKSPACE_TEMPLATE))) ?? MADR_MINIMAL;
    text = fillTemplate(template, { title, date, elements: links.elements, views: links.views });
  }

  const { yaml, body } = splitFrontmatter(text);
  const frontmatter = new YamlFile(yaml ?? null);
  frontmatter.set(["status"], "proposed");
  frontmatter.set(["date"], date);
  for (const [field, refs] of Object.entries(links)) {
    if (refs.length > 0) frontmatter.set([field], refs, { flow: true });
  }
  edit.create(join(folder, `${number}-${slug}.md`), `---\n${frontmatter.toString()}---\n\n${body.trimEnd()}\n`);
  return { ok: true, action: "created", item: "adr", subject: { id: `${project.id}:${number}` } };
}

/** Every ADR entry in `field` (`elements` or `views`) that names `id`, as a reference that refuses a removal. */
export function adrReferences(ws: LoadedWorkspace, field: "elements" | "views", id: string): SourceRef[] {
  return ws.adrs.flatMap((a) => {
    const list = a.data[field];
    if (!Array.isArray(list) || !a.frontmatter) return [];
    const at = list.findIndex((ref) => qualify(ref, a.project) === id);
    if (at === -1) return [];
    const adrId = a.project.id !== undefined && a.number !== undefined ? `${a.project.id}:${a.number}` : a.path;
    return [{ file: a.path, line: a.frontmatter.positionOf([field, at]).line + a.lineOffset, what: `ADR ${adrId} links it` }];
  });
}
