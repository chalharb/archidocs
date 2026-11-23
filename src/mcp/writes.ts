import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { nodeFileSystem } from "../core/fs.ts";
import { write, type SourceRef, type WriteItem, type WriteRequest, type WriteResult } from "../writer/index.ts";
import { advertise, toResult, type ToolOutcome } from "./server.ts";
import type { Source } from "./source.ts";

const Project = z.string().min(1).describe("The Project to edit, by id");
const Bare = z.string().min(1);
const Ref = z.string().min(1).describe("An id in this Project (bare), or project:id");
const DryRun = z.boolean().default(false).describe("Check the write and return its diff without changing any file");
const Fields = z
  .record(z.string(), z.unknown())
  .default({})
  .describe("Fields to set, as in YAML; null removes a field. Fields not given are left as they are.");

const WriteOutput = z.object({
  action: z.enum(["created", "updated", "removed", "unchanged"]),
  id: z.string().nullable().describe("The qualified id written (bare for a Team, Environment or Project); null for a Deployment, or a Relationship without one"),
  from: z.string().optional(),
  to: z.string().optional(),
  service: z.string().optional(),
  environment: z.string().optional(),
  target: z.string().optional(),
  files: z.array(z.string()),
  diff: z.string(),
  dryRun: z.boolean(),
});

/**
 * The Model write tools: thin adapters over the YAML writer. Each edits the
 * checkout's YAML in place, refuses with `validation_failed` if the edit
 * would introduce an error, takes `dry_run` and returns a unified diff.
 * They never touch git. With `readOnly` set (a Bundle source, or HTTP
 * without --allow-writes) each returns `read_only` with that reason.
 */
export function registerWriteTools(server: McpServer, source: Source, readOnly: string | undefined): void {
  const fs = nodeFileSystem();

  const writeTool = <I extends z.ZodObject>(name: string, config: { title: string; description: string; input: I; destructive?: boolean; idempotent?: boolean }, toRequest: (args: z.output<I>) => WriteRequest) => {
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: advertise(config.input),
        outputSchema: WriteOutput,
        annotations: { readOnlyHint: false, destructiveHint: config.destructive ?? false, idempotentHint: config.idempotent ?? true, openWorldHint: false },
      },
      async (raw: unknown): Promise<CallToolResult> => {
        if (readOnly !== undefined || source.kind !== "checkout") return toResult({ ok: false, code: "read_only", message: readOnly ?? "Write tools need a checkout." });
        const args = config.input.safeParse(raw ?? {});
        if (!args.success) return toResult({ ok: false, code: "invalid_input", message: z.prettifyError(args.error) });
        const dryRun = (args.data as { dry_run: boolean }).dry_run;
        let result: WriteResult;
        try {
          result = await write({ fs, root: source.root }, toRequest(args.data), { dryRun });
        } catch (error) {
          return toResult({ ok: false, code: "source_unavailable", message: `Could not write the Workspace at ${source.root}: ${error instanceof Error ? error.message : String(error)}` });
        }
        return toResult(outcome(result));
      },
    );
  };

  writeTool(
    "upsert_element",
    {
      title: "Add or update an Element",
      description: [
        "Adds an Element, or updates the fields of an existing one, in its Project's YAML; comments and formatting are kept.",
        "A new Element goes into its parent's file; with `file` as well, it goes top-level there and attaches with `in:`. A new top-level Element goes into `file` (relative to the Project's folder), else `model.yaml`.",
      ].join(" "),
      input: z.object({
        project: Project,
        kind: z.enum(["person", "system", "service", "component"]),
        id: Ref,
        fields: Fields,
        parent: Ref.optional().describe("The parent Element, for a new Service or Component"),
        file: z.string().optional().describe("For a new Element: a .yaml file relative to the Project's folder"),
        dry_run: DryRun,
      }),
    },
    (a) => ({ op: "upsert-element", project: a.project, kind: a.kind, id: a.id, fields: a.fields, ...(a.parent === undefined ? {} : { parent: a.parent }), ...(a.file === undefined ? {} : { file: a.file }) }),
  );

  writeTool(
    "upsert_relationship",
    {
      title: "Add or update a Relationship",
      description: [
        "Adds a Relationship from a consumer Element in this Project to its provider, or updates one, under the consumer's `relationships`; comments and formatting are kept.",
        "A Relationship is named by (from, to) plus `id` if given. With no id and several on the pair, returns `ambiguous` with each candidate's file:line.",
      ].join(" "),
      input: z.object({
        project: Project,
        from: Ref.describe("The consumer Element, in this Project"),
        to: Ref.describe("The provider Element: an id in this Project, or project:id"),
        fields: Fields,
        id: Ref.optional().describe("The Relationship's id, to pick one of several on a pair or to give a new one an id"),
        dry_run: DryRun,
      }),
    },
    (a) => ({ op: "upsert-relationship", project: a.project, from: a.from, to: a.to, fields: a.fields, ...(a.id === undefined ? {} : { id: a.id }) }),
  );

  writeTool(
    "remove_element",
    {
      title: "Remove an Element",
      description:
        "Removes an Element and the Relationships declared under it. Refused while anything still references it (an Element in it, a Relationship to or via it, a Deployment of it), with each reference's file:line; nothing cascades.",
      input: z.object({ project: Project, id: Ref, dry_run: DryRun }),
      destructive: true,
    },
    (a) => ({ op: "remove-element", project: a.project, id: a.id }),
  );

  writeTool(
    "remove_relationship",
    {
      title: "Remove a Relationship",
      description: "Removes one Relationship, named by (from, to) plus `id` if given. With no id and several on the pair, returns `ambiguous` with each candidate's file:line.",
      input: z.object({ project: Project, from: Ref, to: Ref, id: Ref.optional(), dry_run: DryRun }),
      destructive: true,
    },
    (a) => ({ op: "remove-relationship", project: a.project, from: a.from, to: a.to, ...(a.id === undefined ? {} : { id: a.id }) }),
  );

  writeTool(
    "upsert_target",
    {
      title: "Add or update a Deployment Target",
      description: [
        "Adds a Deployment Target, or updates the fields of an existing one (name, kind, description, owner, tags, links); comments and formatting are kept.",
        "A new Target nests under `parent` in the parent's file. A new top-level one goes into `file` (relative to the Project's folder), else `model.yaml`.",
      ].join(" "),
      input: z.object({
        project: Project,
        id: Ref,
        fields: Fields,
        parent: Ref.optional().describe("The Target to nest a new one under"),
        file: z.string().optional().describe("For a new top-level Target: a .yaml file relative to the Project's folder"),
        dry_run: DryRun,
      }),
    },
    (a) => ({ op: "upsert-target", project: a.project, id: a.id, fields: a.fields, ...(a.parent === undefined ? {} : { parent: a.parent }), ...(a.file === undefined ? {} : { file: a.file }) }),
  );

  writeTool(
    "remove_target",
    {
      title: "Remove a Deployment Target",
      description: "Removes a Deployment Target. Refused while a Target is nested in it or a Deployment uses it, with each reference's file:line; nothing cascades.",
      input: z.object({ project: Project, id: Ref, dry_run: DryRun }),
      destructive: true,
    },
    (a) => ({ op: "remove-target", project: a.project, id: a.id }),
  );

  const Triple = {
    service: Ref.describe("The Service deployed: an id in this Project, or project:id"),
    environment: Bare.describe("The Environment, by bare id"),
    target: Ref.describe("The Deployment Target: an id in this Project, or project:id"),
  };

  writeTool(
    "upsert_deployment",
    {
      title: "Add or update a Deployment",
      description: [
        "Adds a Deployment, or updates the fields (url, endpoints) of the one its (service, environment, target) triple names, in this Project's YAML; comments and formatting are kept.",
        "A new one goes into `file` (relative to the Project's folder), else beside the Project's other Deployments, else into `model.yaml`.",
      ].join(" "),
      input: z.object({
        project: Project,
        ...Triple,
        fields: Fields,
        file: z.string().optional().describe("For a new Deployment: a .yaml file relative to the Project's folder"),
        dry_run: DryRun,
      }),
    },
    (a) => ({ op: "upsert-deployment", project: a.project, service: a.service, environment: a.environment, target: a.target, fields: a.fields, ...(a.file === undefined ? {} : { file: a.file }) }),
  );

  writeTool(
    "remove_deployment",
    {
      title: "Remove a Deployment",
      description: "Removes the Deployment its (service, environment, target) triple names from this Project's YAML.",
      input: z.object({ project: Project, ...Triple, dry_run: DryRun }),
      destructive: true,
    },
    (a) => ({ op: "remove-deployment", project: a.project, service: a.service, environment: a.environment, target: a.target }),
  );

  writeTool(
    "upsert_team",
    {
      title: "Add or update a Team",
      description: "Adds a Team to workspace.yaml, or updates the fields (name, description, links) of an existing one; comments and formatting are kept.",
      input: z.object({ id: Bare.describe("The Team's bare id"), fields: Fields, dry_run: DryRun }),
    },
    (a) => ({ op: "upsert-team", id: a.id, fields: a.fields }),
  );

  writeTool(
    "upsert_environment",
    {
      title: "Add or update an Environment",
      description: "Adds an Environment to workspace.yaml, or updates the fields (name, description) of an existing one; comments and formatting are kept.",
      input: z.object({ id: Bare.describe("The Environment's bare id"), fields: Fields, dry_run: DryRun }),
    },
    (a) => ({ op: "upsert-environment", id: a.id, fields: a.fields }),
  );

  writeTool(
    "upsert_view",
    {
      title: "Add or update a Saved View",
      description: [
        "Adds a Saved structural or Deployment View under `views: structural:` in a Project's YAML, or replaces an existing one's definition; comments on keys left unchanged are kept.",
        "`definition` has the YAML structure: title, level (c1|c2|c3|deployment), include/exclude selectors (an id; {element, with, upstream, downstream}; {team}; {tag}; {from, to, paths}), expand, collapse, direction, lens, and for a Deployment View environment and targets. Ids are bare in this Project, or project:id.",
        "A new View goes into `file` (relative to the Project's folder), else `model.yaml`.",
      ].join(" "),
      input: z.object({
        project: Project,
        id: Ref.describe("The View's id, unique among this Project's Views"),
        definition: z.record(z.string(), z.unknown()).describe("The View as written in YAML"),
        file: z.string().optional().describe("For a new View: a .yaml file relative to the Project's folder"),
        dry_run: DryRun,
      }),
    },
    (a) => ({ op: "upsert-view", project: a.project, id: a.id, definition: a.definition, ...(a.file === undefined ? {} : { file: a.file }) }),
  );

  writeTool(
    "remove_view",
    {
      title: "Remove a Saved View",
      description: "Removes a Saved View from its Project's YAML.",
      input: z.object({ project: Project, id: Ref, dry_run: DryRun }),
      destructive: true,
    },
    (a) => ({ op: "remove-view", project: a.project, id: a.id }),
  );

  writeTool(
    "create_project",
    {
      title: "Create a Project",
      description: "Writes a new Project's project.yaml into `folder` (relative to the Workspace root; `<id>/` by default). Refused for an id already in use, and for a folder inside another Project or holding one.",
      input: z.object({
        id: Bare.describe("The new Project's id"),
        name: z.string().min(1),
        owner: Bare.describe("The owning Team, by bare id"),
        folder: z.string().optional().describe("The Project's folder, relative to the Workspace root"),
        dry_run: DryRun,
      }),
      idempotent: false,
    },
    (a) => ({ op: "create-project", id: a.id, name: a.name, owner: a.owner, ...(a.folder === undefined ? {} : { folder: a.folder }) }),
  );
}

function outcome(result: WriteResult): ToolOutcome {
  if (!result.ok) {
    const { code, message, suggestions, issues, candidates, references } = result;
    const refs = (title: string, list: SourceRef[] | undefined) => (list?.length ? [title, ...list.map((r) => `- ${r.file}:${r.line} ${r.what}`)] : []);
    const detailText = [
      ...(issues?.length ? ["Issues:", ...issues.map((i) => `- ${i.file}:${i.line} ${i.rule}: ${i.message}`)] : []),
      ...refs("Candidates:", candidates),
      ...refs("Referenced by:", references),
    ].join("\n");
    const details = { ...(issues ? { issues } : {}), ...(candidates ? { candidates } : {}), ...(references ? { references } : {}) };
    return { ok: false, code, message, ...(suggestions ? { suggestions } : {}), details, ...(detailText ? { detailText } : {}) };
  }
  const { item, subject, action, files, diff, dryRun } = result;
  const what = describe(item, subject);
  const verb = dryRun && action !== "unchanged" ? `would be ${action}` : action;
  const head = `${what} ${verb}${files.length ? ` in ${files.join(", ")}` : ""}${dryRun ? " (dry run; nothing written)" : ""}.`;
  return {
    ok: true,
    data: {
      action,
      id: subject.id ?? null,
      ...(item === "relationship" ? { from: subject.from, to: subject.to } : {}),
      ...(item === "deployment" ? { service: subject.service, environment: subject.environment, target: subject.target } : {}),
      files,
      diff,
      dryRun,
    },
    text: diff ? `${head}\n\n\`\`\`diff\n${diff}\`\`\`` : head,
  };
}

function describe(item: WriteItem, subject: Record<string, string | null>): string {
  switch (item) {
    case "relationship":
      return `Relationship ${subject.from} -> ${subject.to}${subject.id ? ` (${subject.id})` : ""}`;
    case "deployment":
      return `Deployment of ${subject.service} to ${subject.environment} on ${subject.target}`;
    case "target":
      return `Deployment Target ${subject.id}`;
    case "view":
      return `Saved View ${subject.id}`;
    default:
      return `${item[0]!.toUpperCase()}${item.slice(1)} ${subject.id}`;
  }
}
