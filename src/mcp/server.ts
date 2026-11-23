import { McpServer, type CallToolResult, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { suggest } from "../core/suggest.ts";
import { BundleElement } from "../schema/bundle.ts";
import type { Snapshot, Source } from "./source.ts";

export interface ServerOptions {
  source: Source;
  /** Base URL of a published viewer; when set, results carry `viewerUrl` links. */
  viewerUrl?: string;
}

/** The typed error codes a tool result can carry in `structuredContent.code`. */
export type ErrorCode = "not_found" | "ambiguous" | "invalid_input" | "validation_failed" | "read_only" | "source_unavailable";

type ToolOutcome = { ok: true; data: Record<string, unknown>; text: string } | { ok: false; code: ErrorCode; message: string; suggestions?: string[] };

const ok = (data: Record<string, unknown>, text: string): ToolOutcome => ({ ok: true, data, text });
const fail = (code: ErrorCode, message: string, suggestions?: string[]): ToolOutcome => ({ ok: false, code, message, ...(suggestions ? { suggestions } : {}) });

/**
 * The Archidocs MCP server: stateless read tools over one Source. Every
 * result is `structuredContent` plus a compact Markdown copy; a lookup that
 * fails is a tool result with `isError` and `{code, message, suggestions?}`.
 * Only a malformed request (unknown tool, arguments that are not an object)
 * is a protocol error.
 */
export function createServer(options: ServerOptions): McpServer {
  const { source } = options;
  const server = new McpServer({ name: "archidocs", version: "0.0.0" }, { capabilities: { tools: {} } });

  const tool = <I extends z.ZodObject>(
    name: string,
    config: { title: string; description: string; input: I; output: z.ZodType },
    run: (args: z.output<I>, snapshot: Snapshot) => ToolOutcome,
  ) => {
    server.registerTool(
      name,
      { title: config.title, description: config.description, inputSchema: advertise(config.input), outputSchema: config.output, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (raw: unknown): Promise<CallToolResult> => {
        const args = config.input.safeParse(raw ?? {});
        if (!args.success) return toResult(fail("invalid_input", z.prettifyError(args.error)));
        let snapshot: Snapshot;
        try {
          snapshot = await source.snapshot();
        } catch (error) {
          return toResult(fail("source_unavailable", `Could not read the Workspace at ${source.root}: ${error instanceof Error ? error.message : String(error)}`));
        }
        return toResult(run(args.data, snapshot));
      },
    );
  };

  tool(
    "get_workspace_info",
    {
      title: "Workspace info",
      description: "Where this server reads the Workspace from, the commit it reflects, whether write tools are allowed, and how big the Model is.",
      input: z.object({}),
      output: z.object({
        source: z.object({ kind: z.literal("checkout"), root: z.string() }),
        commit: z.string().nullable(),
        writesAllowed: z.boolean(),
        counts: z.object({ projects: z.number(), elements: z.number(), teams: z.number(), environments: z.number() }),
        issues: z.object({ errors: z.number(), warnings: z.number() }),
        viewerUrl: z.string().optional(),
      }),
    },
    (_, { bundle, issues }) => {
      const counts = { projects: bundle.projects.length, elements: bundle.elements.length, teams: bundle.teams.length, environments: bundle.environments.length };
      const errors = issues.filter((i) => i.severity === "error").length;
      const data = {
        source: { kind: source.kind, root: source.root },
        commit: bundle.commit,
        writesAllowed: source.writesAllowed,
        counts,
        issues: { errors, warnings: issues.length - errors },
        ...(options.viewerUrl ? { viewerUrl: options.viewerUrl } : {}),
      };
      const at = bundle.commit ? `at ${bundle.commit.slice(0, 7)}` : "with no commit";
      return ok(
        data,
        [
          `Workspace from a checkout ${at} (${source.root}); writes ${source.writesAllowed ? "allowed" : "off"}.`,
          `- ${counts.projects} Projects, ${counts.elements} Elements, ${counts.teams} Teams, ${counts.environments} Environments`,
          `- ${errors} errors, ${issues.length - errors} warnings from check`,
        ].join("\n"),
      );
    },
  );

  tool(
    "get_element",
    {
      title: "Get Element",
      description: "One Element by qualified id (project:id): its fields, Owner Team, parent and children, and the file and line it is declared at.",
      input: z.object({ id: QualifiedId }),
      output: z.object({
        element: BundleElement,
        owner: z.object({ id: z.string(), name: z.string() }).nullable(),
        parent: ElementSummary.nullable(),
        children: z.array(ElementSummary),
        viewerUrl: z.string().optional(),
      }),
    },
    ({ id }, { bundle }) => {
      const element = bundle.elements.find((e) => e.id === id);
      if (!element) return notFound("Element", id, bundle.elements.map((e) => e.id));
      const parent = bundle.elements.find((e) => e.id === element.parent);
      const children = bundle.elements.filter((e) => e.parent === id);
      const team = bundle.teams.find((t) => t.id === element.owner);
      const data = {
        element,
        owner: team ? { id: team.id, name: team.name } : null,
        parent: parent ? summary(parent) : null,
        children: children.map(summary),
        ...viewerLink(options.viewerUrl, id),
      };
      const fields: [string, unknown][] = [
        ["description", element.description],
        ["type", element.kind === "service" && element.type !== "app" ? element.type : null],
        ["technology", "technology" in element ? element.technology : null],
        ["external", "external" in element && element.external ? "yes" : null],
        ["tags", element.tags.join(", ")],
        ["links", element.links.map((l) => `[${l.label}](${l.url})`).join(", ")],
        ["children", children.map(label).join(", ")],
      ];
      return ok(
        data,
        [
          `${kindName[element.kind]} ${label(element)}, owned by ${element.owner || "no Team"}${parent ? `, in ${parent.id}` : ""}; ${element.source.file}:${element.source.line}.`,
          ...fields.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${String(v)}`),
        ].join("\n"),
      );
    },
  );

  tool(
    "search_elements",
    {
      title: "Search Elements",
      description:
        "Find Elements whose qualified id or name contains the query (case-insensitive). Exact matches come first, then prefixes, then the rest, each by id.",
      input: z.object({
        query: z.string().min(1),
        kind: z.enum(["person", "system", "service", "component"]).optional(),
        limit: Limit,
      }),
      output: z.object({
        query: z.string(),
        total: z.number(),
        truncated: z.boolean(),
        elements: z.array(ElementSummary.extend({ owner: z.string(), parent: z.string().nullable(), viewerUrl: z.string().optional() })),
      }),
    },
    ({ query, kind, limit }, { bundle }) => {
      const q = query.toLowerCase();
      const ranked = bundle.elements
        .filter((e) => !kind || e.kind === kind)
        .map((e) => ({ e, rank: matchRank(q, e) }))
        .filter((m) => m.rank !== undefined)
        .sort((a, b) => a.rank! - b.rank! || (a.e.id < b.e.id ? -1 : 1))
        .map(({ e }) => ({ id: e.id, kind: e.kind, name: e.name, owner: e.owner, parent: e.parent, ...viewerLink(options.viewerUrl, e.id) }));
      const { items, total, truncated } = page(ranked, limit);
      const head =
        total === 0
          ? `No Elements match "${query}".`
          : `${total} ${total === 1 ? "Element matches" : "Elements match"} "${query}"${truncated ? `; showing the first ${limit}` : ""}.`;
      return ok(
        { query, total, truncated, elements: items },
        [head, ...items.map((e) => `- ${label(e)}: ${kindName[e.kind]}, ${e.owner || "no Team"}`)].join("\n"),
      );
    },
  );

  tool(
    "list_teams",
    {
      title: "List Teams",
      description: "Every Team defined in the Workspace, with how many Elements each owns.",
      input: z.object({ limit: Limit }),
      output: z.object({
        total: z.number(),
        truncated: z.boolean(),
        teams: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), links: z.array(z.object({ label: z.string(), url: z.string() })), elements: z.number() })),
      }),
    },
    ({ limit }, { bundle }) => {
      const teams = bundle.teams.map((t) => ({ id: t.id, name: t.name, description: t.description, links: t.links, elements: bundle.elements.filter((e) => e.owner === t.id).length }));
      const { items, total, truncated } = page(teams, limit);
      return ok(
        { total, truncated, teams: items },
        [
          listHead(total, "Team", truncated, limit),
          ...items.map((t) => `- ${label(t)}: owns ${t.elements} Element${t.elements === 1 ? "" : "s"}${t.description ? `; ${t.description}` : ""}`),
        ].join("\n"),
      );
    },
  );

  tool(
    "list_environments",
    {
      title: "List Environments",
      description: "Every Environment defined in the Workspace.",
      input: z.object({ limit: Limit }),
      output: z.object({
        total: z.number(),
        truncated: z.boolean(),
        environments: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable() })),
      }),
    },
    ({ limit }, { bundle }) => {
      const environments = bundle.environments.map((e) => ({ id: e.id, name: e.name, description: e.description }));
      const { items, total, truncated } = page(environments, limit);
      return ok(
        { total, truncated, environments: items },
        [listHead(total, "Environment", truncated, limit), ...items.map((e) => `- ${label(e)}${e.description ? `: ${e.description}` : ""}`)].join("\n"),
      );
    },
  );

  return server;
}

const Limit = z.number().int().min(1).default(50).describe("The most items to return; `truncated` says whether there were more");

function page<T>(all: T[], limit: number): { items: T[]; total: number; truncated: boolean } {
  return { items: all.slice(0, limit), total: all.length, truncated: all.length > limit };
}

const listHead = (total: number, noun: string, truncated: boolean, limit: number) =>
  `${total} ${noun}${total === 1 ? "" : "s"}${truncated ? `; showing the first ${limit}` : ""}.`;

/** 0 for an exact id, bare id or name; 1 for a prefix of one; 2 for a substring of one; undefined for no match. */
function matchRank(q: string, e: BundleElement): number | undefined {
  const fields = [e.id, e.id.slice(e.id.indexOf(":") + 1), e.name].map((f) => f.toLowerCase());
  if (fields.some((f) => f === q)) return 0;
  if (fields.some((f) => f.startsWith(q))) return 1;
  if (fields.some((f) => f.includes(q))) return 2;
  return undefined;
}

const QualifiedId = z.string().min(1).describe("A qualified id, project:id");

const ElementSummary = z.object({ id: z.string(), kind: z.enum(["person", "system", "service", "component"]), name: z.string() });
const summary = (e: BundleElement) => ({ id: e.id, kind: e.kind, name: e.name });
const label = (e: { id: string; name: string }) => `${e.id} (${e.name})`;
const kindName = { person: "Person", system: "System", service: "Service", component: "Component" } as const;

/** `{viewerUrl}` for an Element when a viewer base URL is configured, else nothing. */
function viewerLink(base: string | undefined, id: string): { viewerUrl?: string } {
  if (!base) return {};
  const url = new URL(base);
  url.hash = `/element/${id}`;
  return { viewerUrl: url.href };
}

/**
 * `not_found` for an unknown id, suggesting every qualified id with the same
 * bare id (a missing or wrong Project) and the nearest one by spelling.
 */
function notFound(what: string, id: string, known: string[]): ToolOutcome {
  const bare = id.slice(id.indexOf(":") + 1);
  const sameBare = known.filter((k) => k.slice(k.indexOf(":") + 1) === bare);
  const near = suggest(id, known);
  const suggestions = [...new Set([...sameBare, ...(near ? [near] : [])])].slice(0, 5);
  return fail("not_found", `No ${what} "${id}".`, suggestions.length ? suggestions : undefined);
}

function toResult(outcome: ToolOutcome): CallToolResult {
  if (outcome.ok) return { content: [{ type: "text", text: outcome.text }], structuredContent: outcome.data };
  const error = { code: outcome.code, message: outcome.message, ...(outcome.suggestions ? { suggestions: outcome.suggestions } : {}) };
  const hint = error.suggestions?.length ? `\nDid you mean: ${error.suggestions.join(", ")}?` : "";
  return { content: [{ type: "text", text: `${error.code}: ${error.message}${hint}` }], structuredContent: error, isError: true };
}

/**
 * Advertises `schema` in `tools/list` but lets every object through to the
 * handler, which parses it itself. The SDK would otherwise turn bad arguments
 * into a plain-text error; this way they become a typed `invalid_input`.
 */
function advertise(schema: z.ZodObject): StandardSchemaWithJSON {
  return {
    "~standard": {
      version: 1,
      vendor: "archidocs",
      validate: (value: unknown) => ({ value }),
      jsonSchema: schema["~standard"].jsonSchema,
    },
  };
}
