import { McpServer, type CallToolResult, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDeployments, type DeploymentDetail } from "../core/deployments.ts";
import { withDocs } from "../core/rules.ts";
import { search } from "../core/search.ts";
import {
  changeKinds,
  countChanges,
  deriveEdges,
  diff,
  filterChanges,
  findPaths,
  getImpact,
  levelOf,
  listOwned,
  resolveScope,
  scopeMatcher,
  type Change,
  type ChangeCounts,
  type HistoryScope,
  type ImpactRing,
} from "../core/index.ts";
import { suggest } from "../core/suggest.ts";
import { describeLens, listViews, resolveView, type ResolvedStep, type ViewNode } from "../core/views/index.ts";
import { listAdrs, type ListedAdr } from "../core/adrs.ts";
import { AdrStatus } from "../schema/adr.ts";
import { BundleAdr, BundleDeployment, BundleElement, BundleLens, BundleRelationship, type Bundle } from "../schema/bundle.ts";
import type { Snapshot, Source } from "./source.ts";
import { pastOf, type Past } from "./history.ts";
import { registerWriteTools } from "./writes.ts";
import { authoringGuide, topics } from "../guide/index.ts";

export interface ServerOptions {
  source: Source;
  /** Base URL of a published viewer; when set, results carry `viewerUrl` links. */
  viewerUrl?: string;
  /**
   * Whether the transport lets write tools run. True by default (stdio);
   * false over HTTP unless `--allow-writes` is passed. Writes also need a
   * source that takes them: a Bundle never does.
   */
  allowWrites?: boolean;
}

/** The typed error codes a tool result can carry in `structuredContent.code`. */
export type ErrorCode = "not_found" | "ambiguous" | "invalid_input" | "validation_failed" | "read_only" | "source_unavailable" | "history_unavailable";

export type ToolOutcome =
  | { ok: true; data: Record<string, unknown>; text: string }
  | { ok: false; code: ErrorCode; message: string; suggestions?: string[]; details?: Record<string, unknown>; detailText?: string };

const ok = (data: Record<string, unknown>, text: string): ToolOutcome => ({ ok: true, data, text });
const fail = (code: ErrorCode, message: string, suggestions?: string[]): ToolOutcome => ({ ok: false, code, message, ...(suggestions ? { suggestions } : {}) });

/**
 * The Archidocs MCP server: stateless tools over one Source. Every result is
 * `structuredContent` plus a compact Markdown copy; a lookup that fails is a
 * tool result with `isError` and `{code, message, suggestions?}`. Only a
 * malformed request (unknown tool, arguments that are not an object) is a
 * protocol error. Write tools return `read_only` unless both the source and
 * the transport allow writes.
 */
export function createServer(options: ServerOptions): McpServer {
  const { source } = options;
  const server = new McpServer({ name: "archidocs", version: "0.0.0" }, { capabilities: { tools: {} } });
  const writesAllowed = source.writesAllowed && options.allowWrites !== false;
  const readOnlyReason =
    source.kind === "bundle"
      ? `This server reads a published Bundle (${source.location}); write tools need a checkout.`
      : "Write tools are off over HTTP; restart the server with --allow-writes to allow them.";

  const past = pastOf(source);

  /**
   * Registers a tool. A read tool also takes `at` (a ref or a date) and runs
   * over the Bundle there; a write tool refuses `at`.
   */
  const tool = <I extends z.ZodObject>(
    name: string,
    config: { title: string; description: string; input: I; output: z.ZodType; write?: boolean },
    run: (args: z.output<I>, snapshot: Snapshot, context: ToolContext) => ToolOutcome | Promise<ToolOutcome>,
  ) => {
    const input: z.ZodObject = config.write ? config.input : config.input.extend({ at: At.optional() });
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: advertise(input),
        outputSchema: config.output,
        annotations: { readOnlyHint: !config.write, openWorldHint: false },
      },
      async (raw: unknown): Promise<CallToolResult> => {
        if (config.write && !writesAllowed) return toResult(fail("read_only", readOnlyReason));
        if (config.write && takesAt(raw)) return toResult(fail("invalid_input", atRefused));
        const args = input.safeParse(raw ?? {});
        if (!args.success) return toResult(fail("invalid_input", z.prettifyError(args.error)));
        const { at, ...rest } = args.data as { at?: string };
        let snapshot: Snapshot;
        try {
          snapshot = await source.snapshot();
        } catch (error) {
          return toResult(fail("source_unavailable", `Could not read the Workspace from ${where(source)}: ${error instanceof Error ? error.message : String(error)}`));
        }
        const current = snapshot;
        if (at !== undefined) {
          const then = await past.at(at, snapshot);
          if (!then.ok) return toResult(then);
          snapshot = then.snapshot;
        }
        return toResult(await run(rest as z.output<I>, snapshot, { past, at, current }));
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
        source: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("checkout"), root: z.string() }),
          z.object({ kind: z.literal("bundle"), location: z.string() }),
        ]),
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
        source: source.kind === "checkout" ? { kind: source.kind, root: source.root } : { kind: source.kind, location: source.location },
        commit: bundle.commit,
        writesAllowed,
        counts,
        issues: { errors, warnings: issues.length - errors },
        ...(options.viewerUrl ? { viewerUrl: options.viewerUrl } : {}),
      };
      const at = bundle.commit ? `at ${bundle.commit.slice(0, 7)}` : "with no commit";
      return ok(
        data,
        [
          `Workspace from a ${source.kind === "checkout" ? "checkout" : "Bundle"} ${at} (${where(source)}); writes ${writesAllowed ? "allowed" : "off"}.`,
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
      description:
        "One Element by qualified id (project:id): its fields, Owner Team, parent and children, the Relationships declared on it in and out, the edges derived onto it from its descendants', a Service's Deployments with their URLs, the Dynamic Views it takes part in (as a participant, or as the broker of an event Step), the ADRs linking it or its descendants (as list_adrs gives them), and the file and line it is declared at.",
      input: z.object({ id: QualifiedId }),
      output: z.object({
        element: BundleElement,
        owner: z.object({ id: z.string(), name: z.string() }).nullable(),
        parent: ElementSummary.nullable(),
        children: z.array(ElementSummary),
        deployments: z.array(DeploymentResult),
        relationships: z.object({ in: z.array(BundleRelationship), out: z.array(BundleRelationship) }),
        derived: z.object({ in: z.array(Edge), out: z.array(Edge) }),
        dynamicViews: z.array(z.object({ id: z.string(), title: z.string() })),
        adrs: z.array(AdrSummary),
        viewerUrl: z.string().optional(),
      }),
    },
    ({ id }, { bundle }) => {
      const element = bundle.elements.find((e) => e.id === id);
      if (!element) return notFound("Element", id, bundle.elements.map((e) => e.id));
      const parent = bundle.elements.find((e) => e.id === element.parent);
      const children = bundle.elements.filter((e) => e.parent === id);
      const team = bundle.teams.find((t) => t.id === element.owner);
      const deployments = getDeployments(bundle, id).map(deploymentResult);
      const relationships = { in: bundle.relationships.filter((r) => r.to === id), out: bundle.relationships.filter((r) => r.from === id) };
      // Edges at the Element's level that carry at least one Relationship declared beneath either end.
      const derived = deriveEdges(bundle, levelOf(element)).filter((e) => e.relationships.some((r) => r.from !== e.from || r.to !== e.to));
      const derivedEdges = { in: derived.filter((e) => e.to === id), out: derived.filter((e) => e.from === id) };
      const dynamicViews = listViews(bundle, { kind: "dynamic", element: id }).map((v) => ({ id: v.id, title: v.title }));
      const data = {
        element,
        owner: team ? { id: team.id, name: team.name } : null,
        parent: parent ? summary(parent) : null,
        children: children.map(summary),
        deployments,
        relationships,
        derived: derivedEdges,
        dynamicViews,
        adrs: listAdrs(bundle, { element: id }).map(adrSummary),
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
        ["deployments", deployments.map((d) => `${d.environment} on ${d.target}${d.url ? ` (${d.url})` : ""}`).join(", ")],
        ["uses", relationships.out.map((r) => `${r.to}${r.description ? ` (${r.description})` : ""}`).join(", ")],
        ["used by", relationships.in.map((r) => `${r.from}${r.description ? ` (${r.description})` : ""}`).join(", ")],
        ["ADRs", data.adrs.map((a) => `${a.id} ${a.title} (${statusLabel(a)})`).join(", ")],
        [
          "derived",
          [...derivedEdges.out.map((e) => `→ ${e.to} (${count(e.relationships.length, "Relationship")})`), ...derivedEdges.in.map((e) => `← ${e.from} (${count(e.relationships.length, "Relationship")})`)].join(", "),
        ],
        ["Dynamic Views", dynamicViews.map((v) => v.id).join(", ")],
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
        "Find Elements whose qualified id or name contains the query, or the Service behind a URL or host (a Deployment's url or an endpoint; a longer URL below one also matches). Case-insensitive. Exact matches come first, then prefixes, then the rest, each by id. A URL match carries the Deployment it matched.",
      input: z.object({
        query: z.string().min(1),
        kind: z.enum(["person", "system", "service", "component"]).optional(),
        limit: Limit,
      }),
      output: z.object({
        query: z.string(),
        total: z.number(),
        truncated: z.boolean(),
        elements: z.array(
          ElementSummary.extend({
            owner: z.string(),
            parent: z.string().nullable(),
            deployment: z.object({ environment: z.string(), target: z.string(), url: z.string() }).optional(),
            viewerUrl: z.string().optional(),
          }),
        ),
      }),
    },
    ({ query, kind, limit }, { bundle }) => {
      const ranked = search(bundle, query, { kind }).map(({ element: e, deployment }) => ({
        id: e.id,
        kind: e.kind,
        name: e.name,
        owner: e.owner,
        parent: e.parent,
        ...(deployment ? { deployment } : {}),
        ...viewerLink(options.viewerUrl, e.id),
      }));
      const { items, total, truncated } = page(ranked, limit);
      const head =
        total === 0
          ? `No Elements match "${query}".`
          : `${total} ${total === 1 ? "Element matches" : "Elements match"} "${query}"${truncated ? `; showing the first ${limit}` : ""}.`;
      return ok(
        { query, total, truncated, elements: items },
        [
          head,
          ...items.map(
            (e) =>
              `- ${label(e)}: ${kindName[e.kind]}, ${e.owner || "no Team"}${e.deployment ? `; URL ${e.deployment.url} in ${e.deployment.environment}` : ""}`,
          ),
        ].join("\n"),
      );
    },
  );

  tool(
    "get_deployments",
    {
      title: "Get Deployments",
      description:
        "Where a Service runs: each Deployment's Environment, its full Deployment Target chain (outermost first), main url and named endpoints. Pass `environment` for one Environment, e.g. a Service's URL in staging.",
      input: z.object({
        service: QualifiedId.describe("The Service's qualified id, project:id"),
        environment: z.string().min(1).optional().describe("An Environment id, such as prod or staging"),
        limit: Limit,
      }),
      output: z.object({
        service: ElementSummary,
        environment: z.string().nullable(),
        total: z.number(),
        truncated: z.boolean(),
        deployments: z.array(DeploymentResult),
      }),
    },
    ({ service: id, environment, limit }, { bundle }) => {
      const service = bundle.elements.find((e) => e.id === id);
      if (!service) return notFound("Service", id, bundle.elements.filter((e) => e.kind === "service").map((e) => e.id));
      if (service.kind !== "service") return fail("invalid_input", `"${id}" is a ${kindName[service.kind]}, not a Service; only Services have Deployments.`);
      if (environment !== undefined && !bundle.environments.some((e) => e.id === environment)) {
        const near = suggest(environment, bundle.environments.map((e) => e.id));
        return fail("not_found", `No Environment "${environment}".`, near ? [near] : undefined);
      }
      const { items, total, truncated } = page(getDeployments(bundle, id, environment).map(deploymentResult), limit);
      const where = environment ? ` in ${environment}` : "";
      const head =
        total === 0 ? `${label(service)} has no Deployments${where}.` : `${label(service)} has ${total} Deployment${total === 1 ? "" : "s"}${where}${truncated ? `; showing the first ${limit}` : ""}.`;
      return ok(
        { service: summary(service), environment: environment ?? null, total, truncated, deployments: items },
        [
          head,
          ...items.map((d) => {
            const chain = d.targetPath.length ? d.targetPath.map((t) => t.id).join(" › ") : d.target;
            const urls = [d.url ?? "no URL", ...d.endpoints.map((e) => `${e.name}: ${e.url}`)].join("; ");
            return `- ${d.environment} on ${chain}: ${urls}`;
          }),
        ].join("\n"),
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

  tool(
    "list_views",
    {
      title: "List Views",
      description:
        "The Generated Views: c1 and c2 (the Landscapes), c2/<system> and c3/<service> (Services with Components); then the Saved Views (project:view-id), structural ones listed under their level and Dynamic Views under `dynamic`. With `element`, only the Views that show that Element as a node, and the Dynamic Views it takes part in (as a participant, or as the broker an event Step runs via).",
      input: z.object({
        kind: ViewKind.optional(),
        element: QualifiedId.optional().describe("Only Views containing this Element (project:id)"),
        limit: Limit,
      }),
      output: z.object({ total: z.number(), truncated: z.boolean(), views: z.array(ViewSummary) }),
    },
    ({ kind, element, limit }, { bundle }) => {
      if (element !== undefined && !bundle.elements.some((e) => e.id === element)) return notFound("Element", element, bundle.elements.map((e) => e.id));
      const { items, total, truncated } = page(listViews(bundle, { kind, element }), limit);
      return ok({ total, truncated, views: items }, [listHead(total, "View", truncated, limit), ...items.map((v) => `- ${v.id}: ${v.title}`)].join("\n"));
    },
  );

  tool(
    "get_view",
    {
      title: "Get View",
      description:
        "One View by id (c1, c2, c2/<system>, c3/<service>, deployment/<environment>, or a Saved View's project:view-id) as nodes and edges. Neighbours outside the focus are collapsed to the highest level that still separates them; each edge carries the declared Relationships beneath it, and `direction` is the way the View draws (a Saved View's own, else TB for a Deployment View, else LR). A Deployment View nests Deployment Targets (kind `target`), a System box per System inside each Target (id `<system>@<target>`) and the Deployments (kind `deployment`, id `<service>@<target>`, `element` the Service, `target` the Deployment Target), and returns its `environment`; a consumer Deployment connects to the provider's Deployments under their deepest shared Target, else to all of them, and a related Service with no Deployment there is a node outside every Target. A Saved View with a Lens also returns the Lens, a `mark` ({hit, distance?, side?}, `side` being origin, upstream or downstream for an impact Lens) per node and `lit` per edge; the Lens never changes which nodes the View holds. A Dynamic View instead returns `participants` in drawing order and `steps` [{n, kind: call|return|event, from, to, relationship, interaction, via?, channel?, description, note?}]: an event is drawn publisher → subscriber while `relationship` is the stored subscriber → publisher subscription; a return replies over the sync `relationship` the other way. Steps that don't resolve are left out (`check` reports them).",
      input: z.object({ id: z.string().min(1).describe("A View id, such as c1, c2/shop:checkout, c3/shop:cart or architecture:purchase") }),
      output: ViewSummary.extend({
        direction: z.enum(["TB", "BT", "LR", "RL"]).optional(),
        environment: z.string().optional(),
        lens: BundleLens.optional(),
        nodes: z
          .array(
            z.object({
              id: z.string(),
              kind: z.enum([...ElementKind.options, "target", "deployment"]),
              name: z.string(),
              element: z.string().optional(),
              target: z.string().optional(),
              parent: z.string().nullable(),
              collapsed: z.boolean(),
              external: z.boolean(),
              mark: z.object({ hit: z.boolean(), distance: z.number().optional(), side: z.enum(["origin", "upstream", "downstream"]).optional() }).optional(),
            }),
          )
          .optional(),
        edges: z.array(z.object({ from: z.string(), to: z.string(), relationships: z.array(BundleRelationship), lit: z.boolean().optional() })).optional(),
        participants: z.array(z.string()).optional(),
        steps: z
          .array(
            z.object({
              n: z.number(),
              kind: z.enum(["call", "return", "event"]),
              from: z.string(),
              to: z.string(),
              relationship: BundleRelationship,
              interaction: z.enum(["sync", "async"]),
              via: z.string().optional(),
              channel: z.string().optional(),
              description: z.string(),
              note: z.string().optional(),
            }),
          )
          .optional(),
      }),
    },
    ({ id }, { bundle }) => {
      const view = resolveView(bundle, id);
      if (!view) return notFound("View", id, listViews(bundle).map((v) => v.id));
      if (view.kind === "dynamic") {
        const dynamic = view;
        return ok(
          { ...dynamic },
          [
            `${dynamic.title} (${dynamic.id}): ${count(dynamic.participants.length, "participant")}, ${count(dynamic.steps.length, "Step")}.`,
            `Participants: ${dynamic.participants.join(", ")}`,
            ...(dynamic.steps.length ? ["Steps:", ...dynamic.steps.map(stepLine)] : []),
          ].join("\n"),
        );
      }
      const edgeCount = `${view.edges.length} edge${view.edges.length === 1 ? "" : "s"}`;
      return ok(
        { ...view },
        [
          `${view.title} (${view.id}): ${view.nodes.length} node${view.nodes.length === 1 ? "" : "s"}, ${edgeCount}.`,
          ...(view.lens ? [`Lens: ${describeLens(bundle, view.lens)}.`] : []),
          "Nodes:",
          ...view.nodes.map(nodeLine),
          ...(view.edges.length ? ["Edges:", ...view.edges.map((e) => `- ${e.from} → ${e.to}: ${e.relationships.map(relationshipLabel).join("; ")}${e.lit ? " (lit)" : ""}`)] : []),
        ].join("\n"),
      );
    },
  );

  tool(
    "find_paths",
    {
      title: "Find paths",
      description:
        "How two Elements are connected: the Relationships directly between them both ways, declared or derived from their descendants' (each derived edge lists the declared Relationships beneath it), and the shortest paths each way up to max_hops, each hop with its Relationships. Compared at the levels of the two Elements given. A `via` broker counts as a hop.",
      input: z.object({
        from: QualifiedId,
        to: QualifiedId,
        max_hops: z.number().int().min(1).max(10).default(4).describe("The longest path to look for, in hops"),
        limit: Limit,
      }),
      output: z.object({
        from: z.string(),
        to: z.string(),
        maxHops: z.number(),
        direct: z.array(z.object({ from: z.string(), to: z.string(), derived: z.boolean(), relationships: z.array(BundleRelationship) })),
        total: z.number(),
        truncated: z.boolean(),
        paths: z.array(z.object({ hops: z.array(Edge) })),
      }),
    },
    ({ from, to, max_hops, limit }, { bundle }) => {
      const missing = unknownElement(bundle, from, to);
      if (missing) return missing;
      if (from === to) return fail("invalid_input", "`from` and `to` name the same Element.");
      const result = findPaths(bundle, from, to, { maxHops: max_hops });
      const { items, total, truncated } = page(result.paths, limit);
      const head = `${from} and ${to}: ${result.direct.length ? `${count(result.direct.length, "direct edge")}` : "no direct Relationships"}; ${
        total ? `${count(total, "shortest path")} within ${max_hops} hops` : `no path within ${max_hops} hops`
      }${truncated ? `; showing the first ${limit}` : ""}.`;
      return ok(
        { from, to, maxHops: max_hops, direct: result.direct, total, truncated, paths: items },
        [
          head,
          ...result.direct.map((d) => `- direct ${d.from} → ${d.to}${d.derived ? " (derived)" : ""}: ${d.relationships.map(relationshipLabel).join(", ")}`),
          ...items.map((p) => `- ${count(p.hops.length, "hop")}: ${[p.hops[0]!.from, ...p.hops.map((h) => h.to)].join(" → ")}`),
        ].join("\n"),
      );
    },
  );

  tool(
    "get_impact",
    {
      title: "Get impact",
      description:
        "Who an outage of an Element affects: the transitive upstream (what depends on it) or downstream (what it depends on) set, grouped by distance, with each Element's Owner and the Relationships that carry the impact from the ring before. Includes the Relationships of the Element's descendants; a `via` broker is a dependency of both its subscriber and its publisher. Logical Model only.",
      input: z.object({
        id: QualifiedId,
        direction: z.enum(["upstream", "downstream", "both"]),
        max_depth: z.number().int().min(1).optional().describe("The furthest distance to follow; unlimited when left out"),
        limit: Limit,
      }),
      output: z.object({
        id: z.string(),
        direction: z.enum(["upstream", "downstream", "both"]),
        maxDepth: z.number().nullable(),
        upstream: ImpactSide.optional(),
        downstream: ImpactSide.optional(),
      }),
    },
    ({ id, direction, max_depth, limit }, { bundle }) => {
      const missing = unknownElement(bundle, id);
      if (missing) return missing;
      const result = getImpact(bundle, id, direction, max_depth === undefined ? {} : { maxDepth: max_depth });
      const sides = (["upstream", "downstream"] as const).flatMap((side) => (result[side] ? [[side, pageRings(result[side], limit)] as const] : []));
      const element = bundle.elements.find((e) => e.id === id)!;
      return ok(
        { id, direction, maxDepth: result.maxDepth, ...Object.fromEntries(sides) },
        [
          `Impact of ${label(element)}: ${sides.map(([side, s]) => `${s.total} ${side}${s.truncated ? ` (showing ${limit})` : ""}`).join(", ")}.`,
          ...sides.flatMap(([side, s]) => [
            `${side[0]!.toUpperCase()}${side.slice(1)}:`,
            ...(s.rings.length ? s.rings.map((r) => `- ${r.distance}: ${r.elements.map((e) => `${e.id} (${e.owner || "no Team"})`).join(", ")}`) : ["- nothing"]),
          ]),
        ].join("\n"),
      );
    },
  );

  tool(
    "list_owned",
    {
      title: "List owned",
      description:
        "The Elements and Deployment Targets a Team owns, grouped by kind, each with counts of the other Teams upstream (depending on it) and downstream (it depends on). An Element is listed under its own Owner, whoever owns its parent.",
      input: z.object({
        team: z.string().min(1).describe("A Team id"),
        kind: OwnedKindSchema.optional(),
        limit: Limit,
      }),
      output: z.object({
        team: z.string(),
        kind: OwnedKindSchema.nullable(),
        total: z.number(),
        truncated: z.boolean(),
        groups: z.array(
          z.object({
            kind: OwnedKindSchema,
            total: z.number(),
            items: z.array(z.object({ id: z.string(), name: z.string(), parent: z.string().nullable(), upstreamTeams: z.number(), downstreamTeams: z.number() })),
          }),
        ),
      }),
    },
    ({ team, kind, limit }, { bundle }) => {
      const found = bundle.teams.find((t) => t.id === team);
      if (!found) return notFound("Team", team, bundle.teams.map((t) => t.id));
      const result = listOwned(bundle, team, kind);
      let left = limit;
      const groups = result.groups
        .map((g) => {
          const items = g.items.slice(0, Math.max(left, 0));
          left -= items.length;
          return { ...g, items };
        })
        .filter((g) => g.items.length);
      const truncated = result.total > limit;
      const teams = (n: number, way: string) => `${n} ${way} Team${n === 1 ? "" : "s"}`;
      return ok(
        { ...result, truncated, groups },
        [
          `${label(found)} owns ${count(result.total, "item")}${kind ? ` of kind ${kind}` : ""}${truncated ? `; showing the first ${limit}` : ""}.`,
          ...groups.flatMap((g) => [
            `${ownedKindName[g.kind]}:`,
            ...g.items.map((i) => {
              const parentElement = bundle.elements.find((e) => e.id === i.parent);
              const elsewhere = parentElement && parentElement.owner !== team ? `, in ${i.parent}` : "";
              return `- ${label(i)}${elsewhere}: ${teams(i.upstreamTeams, "upstream")}, ${teams(i.downstreamTeams, "downstream")}`;
            }),
          ]),
        ].join("\n"),
      );
    },
  );

  tool(
    "list_adrs",
    {
      title: "List ADRs",
      description:
        "Architecture decision records, newest first (by date, then number). With `element`, only the ADRs that link that Element or Deployment Target or any of its descendants (not its ancestors), each with `matchedVia`: the linked ids that matched. `status` filters on the effective status, so `superseded` finds ADRs replaced by an accepted one. Superseded ADRs are included and carry `supersededBy`.",
      input: z.object({
        element: QualifiedId.optional().describe("Only ADRs linking this Element or Deployment Target (project:id), or its descendants"),
        status: AdrStatus.optional().describe("Only ADRs with this effective status"),
        tag: z.string().min(1).optional(),
        limit: Limit,
      }),
      output: z.object({ total: z.number(), truncated: z.boolean(), adrs: z.array(AdrSummary) }),
    },
    ({ element, status, tag, limit }, { bundle }) => {
      if (element !== undefined) {
        const known = [...bundle.elements, ...bundle.targets].map((e) => e.id);
        if (!known.includes(element)) return notFound("Element or Deployment Target", element, known);
      }
      const { items, total, truncated } = page(listAdrs(bundle, { element, status, tag }).map(adrSummary), limit);
      const filters = [element ? `for ${element}` : "", status ? `with status ${status}` : "", tag ? `tagged ${tag}` : ""].filter(Boolean).join(", ");
      return ok(
        { total, truncated, adrs: items },
        [
          `${total} ADR${total === 1 ? "" : "s"}${filters ? ` ${filters}` : ""}${truncated ? `; showing the first ${limit}` : ""}.`,
          ...items.map((a) => `- ${a.id} ${a.title}: ${statusLabel(a)}, ${a.date}${a.matchedVia ? ` (via ${a.matchedVia.join(", ")})` : ""}`),
        ].join("\n"),
      );
    },
  );

  tool(
    "get_adr",
    {
      title: "Get ADR",
      description:
        "One ADR by id (project:NNNN): its title, status as written and effective status, date, linked Elements, Targets and Saved Views, supersedes and the derived supersededBy, decision-makers, consulted, informed, tags, the full markdown body and its file.",
      input: z.object({ id: z.string().min(1).describe("An ADR id, project:NNNN") }),
      output: BundleAdr,
    },
    ({ id }, { bundle }) => {
      const adr = bundle.adrs.find((a) => a.id === id);
      if (!adr) return notFound("ADR", id, bundle.adrs.map((a) => a.id));
      const fields: [string, string][] = [
        ["elements", adr.elements.join(", ")],
        ["views", adr.views.join(", ")],
        ["supersedes", adr.supersedes.join(", ")],
        ["decision-makers", adr.decisionMakers.join(", ")],
        ["consulted", adr.consulted.join(", ")],
        ["informed", adr.informed.join(", ")],
        ["tags", adr.tags.join(", ")],
      ];
      return ok(
        { ...adr },
        [
          `ADR ${adr.id} (${adr.title}): ${adr.status}, ${adr.date}; ${adr.source.file}.`,
          ...(adr.supersededBy.length ? [`Superseded by ${adr.supersededBy.join(", ")}.`] : []),
          ...fields.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`),
          "",
          adr.body.trimEnd(),
        ].join("\n"),
      );
    },
  );

  tool(
    "get_changes",
    {
      title: "Get Changes",
      description:
        "What changed in the Model between two points in time, each a ref (sha, tag or branch) or a date: a flat list of Changes (added, removed or changed), each with the fields that differ and the whole item before and after. `to` defaults to `at`, else the Workspace the server is reading. `scope` narrows to an Element (with its descendants and the Relationships, Deployments and ADRs touching them), a Team (what it owns at either side) or a Project; pass `scope_kind` when a Team and a Project share the id. `kinds` keeps only some item kinds.",
      input: z.object({
        from: Point.describe("The point to compare from: a ref or a date"),
        to: Point.optional().describe("The point to compare to; defaults to `at`, else the current Workspace"),
        scope: z.string().min(1).optional().describe("An Element (project:id), a Team id or a Project id"),
        scope_kind: ScopeKind.optional(),
        kinds: z.array(ChangeKindSchema).min(1).optional().describe(`Only these item kinds: ${changeKinds.join(", ")}`),
        limit: Limit,
      }),
      output: z.object({
        from: z.object({ point: z.string(), commit: z.string() }),
        to: z.object({ point: z.string().nullable(), commit: z.string().nullable() }),
        scope: z.object({ kind: ScopeKind, id: z.string() }).nullable(),
        total: z.number(),
        truncated: z.boolean(),
        counts: z.record(z.string(), z.object({ added: z.number(), removed: z.number(), changed: z.number() })),
        changes: z.array(ChangeRecord),
      }),
    },
    async ({ from, to, scope, scope_kind, kinds, limit }, snapshot, { past, at }) => {
      const before = await past.at(from, snapshot);
      if (!before.ok) return before;
      let after: Snapshot = snapshot;
      if (to !== undefined) {
        const then = await past.at(to, snapshot);
        if (!then.ok) return then;
        after = then.snapshot;
      }
      const sides = [before.snapshot.bundle, after.bundle];
      let resolved: HistoryScope | undefined;
      if (scope !== undefined) {
        const found = resolveScope(scope, sides, scope_kind);
        if (!found.ok) return scopeFailure(scope, found);
        resolved = found.scope;
      }
      const changes = filterChanges(diff(before.snapshot.bundle, after.bundle), { before: before.snapshot.bundle, after: after.bundle, scope: resolved, kinds });
      const { items, total, truncated } = page(changes, limit);
      const toPoint = to ?? at ?? null;
      const short = (sha: string | null) => (sha ? sha.slice(0, 7) : "no commit");
      return ok(
        {
          from: { point: from, commit: before.commit },
          to: { point: toPoint, commit: after.bundle.commit },
          scope: resolved ?? null,
          total,
          truncated,
          counts: countsByKind(changes),
          changes: items,
        },
        [
          `${count(total, "Change")} from ${from} (${short(before.commit)}) to ${toPoint ?? "the current Workspace"} (${short(after.bundle.commit)})${resolved ? ` in ${resolved.kind} ${resolved.id}` : ""}${truncated ? `; showing the first ${limit}` : ""}.`,
          ...items.map(changeLine),
        ].join("\n"),
      );
    },
  );

  tool(
    "list_history",
    {
      title: "List history",
      description:
        "The Revisions (default-branch commits that changed the Workspace), newest first, each with sha, date, subject, author, tags, change counts against the Revision before, and whether its Bundle can be read with `at`. `scope` keeps the Revisions that touched an Element or its descendants, a Team or what it owns, or a Project (as they are at `at`, else now). `since` and `until` are refs or dates, inclusive; with `at`, Revisions after it are left out. Read from the Revision index, so it is cheap.",
      input: z.object({
        scope: z.string().min(1).optional().describe("An Element (project:id), a Team id or a Project id"),
        scope_kind: ScopeKind.optional(),
        since: Point.optional().describe("The earliest point: a ref or a date"),
        until: Point.optional().describe("The latest point: a ref or a date"),
        limit: Limit,
      }),
      output: z.object({
        scope: z.object({ kind: ScopeKind, id: z.string() }).nullable(),
        total: z.number(),
        truncated: z.boolean(),
        revisions: z.array(RevisionRecord),
      }),
    },
    async ({ scope, scope_kind, since, until, limit }, { bundle }, { past, at }) => {
      const listed = await past.index();
      if (!listed.ok) return listed;
      let revisions = listed.revisions;
      for (const [point, edge, keep] of [
        [since, "start", (t: number, d: number) => d >= t],
        [until, "end", (t: number, d: number) => d <= t],
        [at, "end", (t: number, d: number) => d <= t],
      ] as const) {
        if (point === undefined) continue;
        const time = await past.time(point, edge);
        if (!time.ok) return time;
        revisions = revisions.filter((r) => keep(time.time, Date.parse(r.date)));
      }
      let resolved: HistoryScope | undefined;
      if (scope !== undefined) {
        const found = resolveScope(scope, [bundle], scope_kind, listed.revisions.flatMap((r) => r.changedIds));
        if (!found.ok) return scopeFailure(scope, found);
        resolved = found.scope;
        const touched = scopeMatcher(resolved, [bundle]);
        revisions = revisions.filter((r) => touched(r.changedIds));
      }
      const { items, total, truncated } = page(
        revisions.map(({ sha, date, subject, author, tags, counts, bundle: kept }) => ({ sha, date, subject, author, tags, counts, bundle: kept })),
        limit,
      );
      const tally = ({ added, removed, changed }: ChangeCounts) => [added && `+${added}`, removed && `-${removed}`, changed && `~${changed}`].filter(Boolean).join(" ") || "no Changes";
      return ok(
        { scope: resolved ?? null, total, truncated, revisions: items },
        [
          `${count(total, "Revision")}${resolved ? ` touching ${resolved.kind} ${resolved.id}` : ""}${truncated ? `; showing the first ${limit}` : ""}.`,
          ...items.map((r) => `- ${r.sha.slice(0, 7)} ${r.date.slice(0, 10)} ${r.subject} (${r.author})${r.tags.length ? ` [${r.tags.join(", ")}]` : ""}: ${tally(r.counts)}${r.bundle ? "" : " (Bundle not kept)"}`),
        ].join("\n"),
      );
    },
  );

  tool(
    "check",
    {
      title: "Check the Workspace",
      description:
        "Validate the Workspace as it is on disk, as `archidocs check` does, and return its issues. Use it after editing YAML with your own file tools.",
      input: z.object({}),
      output: z.object({ issues: z.array(IssueRecord), summary: z.object({ errors: z.number(), warnings: z.number() }) }),
      write: true,
    },
    (_, { issues }) => {
      const errors = issues.filter((i) => i.severity === "error").length;
      const summary = { errors, warnings: issues.length - errors };
      const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
      return ok(
        { issues: issues.map(withDocs), summary },
        [
          `${plural(errors, "error")}, ${plural(summary.warnings, "warning")}.`,
          ...issues.map((i) => `- ${i.file}:${i.line} ${i.severity} ${i.rule}: ${i.message}`),
        ].join("\n"),
      );
    },
  );

  const GuideInput = z.object({
    topic: z.string().min(1).optional().describe(`One topic's reference file: ${topics.map((t) => t.id).join(", ")}`),
    // Taken like every read tool's, but the guide ships with this Archidocs, so it is the same at every point.
    at: At.optional(),
  });
  server.registerTool(
    "get_authoring_guide",
    {
      title: "Authoring guide",
      description:
        "How to edit the Model with the write tools. With no topic: the archidocs-authoring skill (the Model, the edit loop) and its list of topics. With a topic: that flow's reference file; `rules` is the catalogue of every check rule. Load it before writing.",
      inputSchema: advertise(GuideInput),
      outputSchema: z.object({ topic: z.string().nullable(), topics: z.array(z.object({ id: z.string(), summary: z.string() })), text: z.string() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    // The guide ships with this version, so it answers whatever the state of the source.
    async (raw: unknown): Promise<CallToolResult> => {
      const args = GuideInput.safeParse(raw ?? {});
      if (!args.success) return toResult(fail("invalid_input", z.prettifyError(args.error)));
      const guide = await authoringGuide(args.data.topic);
      if (!guide.ok) return toResult(fail("not_found", guide.message, guide.suggestion ? [guide.suggestion] : undefined));
      return toResult(ok({ topic: guide.topic, topics: topics.map((t) => ({ ...t })), text: guide.text }, guide.text));
    },
  );

  registerWriteTools(server, source, writesAllowed ? undefined : readOnlyReason);
  return server;
}

/** What a tool knows besides its arguments: the source's past, the `at` it was given and the source's current Snapshot. */
export interface ToolContext {
  past: Past;
  at: string | undefined;
  current: Snapshot;
}

const Point = z.string().min(1);
const ScopeKind = z.enum(["element", "team", "project"]).describe("What `scope` names, when a Team and a Project share the id");
const ChangeKindSchema = z.enum(changeKinds);
const ChangeRecord = z.object({
  type: z.enum(["added", "removed", "changed"]),
  kind: ChangeKindSchema,
  id: z.string(),
  fields: z.array(z.string()),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});

const RevisionRecord = z.object({
  sha: z.string(),
  date: z.string(),
  subject: z.string(),
  author: z.string(),
  tags: z.array(z.string()),
  counts: z.object({ added: z.number(), removed: z.number(), changed: z.number() }),
  bundle: z.boolean().describe("Whether the Bundle at this Revision can be read with `at`"),
});

const changeSign = { added: "+", removed: "-", changed: "~" } as const;
const changeLine = (c: Change) => `${changeSign[c.type]} ${c.kind} ${c.id}${c.fields.length ? `: ${c.fields.join(", ")}` : ""}`;

/** Counts of Changes by type for each item kind that has any, in the order kinds are listed. */
function countsByKind(changes: Change[]): Partial<Record<string, ChangeCounts>> {
  return Object.fromEntries(changeKinds.flatMap((k) => {
    const of = changes.filter((c) => c.kind === k);
    return of.length ? [[k, countChanges(of)]] : [];
  }));
}

/** `not_found` or `ambiguous` for a scope that names nothing, or both a Team and a Project. */
function scopeFailure(scope: string, found: Extract<ReturnType<typeof resolveScope>, { ok: false }>): ToolOutcome {
  if (found.reason === "ambiguous") return fail("ambiguous", `"${scope}" is both a ${found.candidates.map((c) => c.kind).join(" and a ")}; pass scope_kind to pick one.`, found.candidates.map((c) => c.kind));
  return notFound("Element, Team or Project", scope, found.known);
}

const At = z.string().min(1).describe("A point in time to answer at: a ref (sha, tag or branch) or a date (YYYY-MM-DD, the last Revision on or before it). Leave out for the current Workspace.");

/** Whether a call's raw arguments carry `at`, which write tools never take. */
export const takesAt = (raw: unknown) => raw !== null && typeof raw === "object" && "at" in raw;
export const atRefused = "Write tools never take `at`: they edit the Workspace as it is now.";

const IssueRecord = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number().optional(),
  rule: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  docs: z.string().describe("The rule's page on the docs site"),
});

const where = (source: Source) => (source.kind === "checkout" ? source.root : source.location);

const ElementKind = z.enum(["person", "system", "service", "component"]);
const ViewKind = z.enum(["c1", "c2", "c3", "deployment", "dynamic"]);
const ViewSummary = z.object({ id: z.string(), kind: ViewKind, title: z.string() });

const nodeKind = (n: ViewNode) => (n.kind === "deployment" ? `Deployment of ${n.element}` : n.kind === "target" ? "Deployment Target" : kindName[n.kind]);
const nodeLine = (n: ViewNode) =>
  `- ${label(n)}: ${nodeKind(n)}${n.external ? ", external" : ""}${n.parent ? ` in ${n.parent}` : ""}${n.collapsed ? ", collapsed" : ""}${n.mark?.hit ? `, hit${n.mark.distance === undefined ? "" : ` at distance ${n.mark.distance}`}${n.mark.side === undefined || n.mark.side === "origin" ? "" : ` ${n.mark.side}`}` : ""}`;

/** A Step as one line: a return drawn dashed (⇠), an event with its broker and channel. */
const stepLine = (s: ResolvedStep) => {
  const how = s.kind === "event" ? ` (event${s.via ? ` via ${s.via}` : ""}${s.channel ? ` · ${s.channel}` : ""})` : s.kind === "return" ? " (return)" : s.interaction === "async" ? " (async)" : "";
  return `${s.n}. ${s.from} ${s.kind === "return" ? "⇠" : "→"} ${s.to}${how}: ${s.description}${s.note ? ` (${s.note})` : ""}`;
};

const relationshipLabel = (r: BundleRelationship) => r.description ?? r.id ?? `${r.from} → ${r.to}`;

const Limit = z.number().int().min(1).default(50).describe("The most items to return; `truncated` says whether there were more");

function page<T>(all: T[], limit: number): { items: T[]; total: number; truncated: boolean } {
  return { items: all.slice(0, limit), total: all.length, truncated: all.length > limit };
}

const listHead = (total: number, noun: string, truncated: boolean, limit: number) =>
  `${total} ${noun}${total === 1 ? "" : "s"}${truncated ? `; showing the first ${limit}` : ""}.`;

const QualifiedId = z.string().min(1).describe("A qualified id, project:id");

const ElementSummary = z.object({ id: z.string(), kind: z.enum(["person", "system", "service", "component"]), name: z.string() });
/** A Deployment as tools return it: its Service is implied by the question. */
const DeploymentResult = BundleDeployment.omit({ service: true }).extend({
  targetPath: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string() })),
});
const deploymentResult = (d: DeploymentDetail) => ({
  environment: d.environment,
  target: d.target,
  targetPath: d.targetPath,
  url: d.url,
  endpoints: d.endpoints,
  owner: d.owner,
  source: d.source,
});

const summary = (e: BundleElement) => ({ id: e.id, kind: e.kind, name: e.name });
const label = (e: { id: string; name: string }) => `${e.id} (${e.name})`;
const kindName = { person: "Person", system: "System", service: "Service", component: "Component" } as const;

const AdrSummary = BundleAdr.pick({ id: true, title: true, status: true, effectiveStatus: true, date: true, elements: true, views: true, supersedes: true, supersededBy: true, tags: true }).extend({
  matchedVia: z.array(z.string()).optional().describe("With `element`: the linked ids that matched"),
});
const adrSummary = (a: ListedAdr) => ({
  id: a.id,
  title: a.title,
  status: a.status,
  effectiveStatus: a.effectiveStatus,
  date: a.date,
  elements: a.elements,
  views: a.views,
  supersedes: a.supersedes,
  supersededBy: a.supersededBy,
  tags: a.tags,
  ...(a.matchedVia ? { matchedVia: a.matchedVia } : {}),
});
const statusLabel = (a: { effectiveStatus: string; supersededBy: string[] }) =>
  a.supersededBy.length ? `superseded by ${a.supersededBy.join(", ")}` : a.effectiveStatus;

const Edge = z.object({ from: z.string(), to: z.string(), relationships: z.array(BundleRelationship) });
const ImpactSide = z.object({
  total: z.number(),
  truncated: z.boolean(),
  rings: z.array(
    z.object({
      distance: z.number(),
      elements: z.array(ElementSummary.extend({ owner: z.string(), relationships: z.array(BundleRelationship) })),
    }),
  ),
});
const OwnedKindSchema = z.enum(["person", "system", "service", "component", "target"]);
const ownedKindName = { person: "Person", system: "System", service: "Service", component: "Component", target: "Deployment Target" } as const;

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The impact rings cut to `limit` Elements in all, nearest first. */
function pageRings(rings: ImpactRing[], limit: number): { total: number; truncated: boolean; rings: ImpactRing[] } {
  const total = rings.reduce((n, r) => n + r.elements.length, 0);
  let left = limit;
  const kept = rings
    .map((r) => {
      const elements = r.elements.slice(0, Math.max(left, 0));
      left -= elements.length;
      return { ...r, elements };
    })
    .filter((r) => r.elements.length);
  return { total, truncated: total > limit, rings: kept };
}

/** `not_found` for the first of `ids` that names no Element, else nothing. */
function unknownElement(bundle: Bundle, ...ids: string[]): ToolOutcome | undefined {
  const known = bundle.elements.map((e) => e.id);
  const missing = ids.find((id) => !known.includes(id));
  return missing === undefined ? undefined : notFound("Element", missing, known);
}

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

export function toResult(outcome: ToolOutcome): CallToolResult {
  if (outcome.ok) return { content: [{ type: "text", text: outcome.text }], structuredContent: outcome.data };
  const error = { code: outcome.code, message: outcome.message, ...(outcome.suggestions ? { suggestions: outcome.suggestions } : {}), ...outcome.details };
  const hint = outcome.suggestions?.length ? `\nDid you mean: ${outcome.suggestions.join(", ")}?` : "";
  const detail = outcome.detailText ? `\n${outcome.detailText}` : "";
  return { content: [{ type: "text", text: `${error.code}: ${error.message}${hint}${detail}` }], structuredContent: error, isError: true };
}

/**
 * Advertises `schema` in `tools/list` but lets every object through to the
 * handler, which parses it itself. The SDK would otherwise turn bad arguments
 * into a plain-text error; this way they become a typed `invalid_input`.
 */
export function advertise(schema: z.ZodObject): StandardSchemaWithJSON {
  return {
    "~standard": {
      version: 1,
      vendor: "archidocs",
      validate: (value: unknown) => ({ value }),
      jsonSchema: schema["~standard"].jsonSchema,
    },
  };
}
