/**
 * The MCP tool reference. The build starts the MCP server in-process over
 * the Kitchen sink checkout, lists its tools like any client, and calls each
 * one with its example input from `EXAMPLES`. Each tool gets a page with its
 * title, description, input and output, the example call and its result.
 * `read-tools` and `write-tools` index them, split by the `readOnlyHint`
 * annotation, and `errors` lists the error codes from `src/mcp/errors.ts`.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { checkoutSource, createServer, ERROR_CODES, type ErrorCode } from "../../../src/mcp/index.ts";
import { POINT_GRAMMAR } from "../../../src/revisions/index.ts";
import { GITHUB_URL, repoPath } from "../lib/repo.ts";
import { fieldSections, fieldTable, type FieldSection, type JsonSchema } from "./json-schema.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/mcp";
/** The Workspace every example runs over, relative to the repo root. */
const WORKSPACE = "examples/kitchen-sink/archidocs";

export interface ListedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

/** A tool call: the tool's name and its arguments. */
interface Call {
  tool: string;
  arguments: Record<string, unknown>;
}

/** The input a tool's page shows it called with. */
export interface ToolExample {
  arguments: Record<string, unknown>;
  /**
   * Writes made first, for real, on a copy of the Kitchen sink: for a tool
   * whose example needs something the Kitchen sink doesn't have.
   */
  before?: { call: Call; /** Why, for the page. */ says: string };
}

/**
 * Each tool's example input, called over the Kitchen sink. A tool that takes
 * `dry_run` is called with `dry_run: true`, so the example writes nothing.
 */
export const EXAMPLES: Readonly<Record<string, ToolExample>> = {
  get_workspace_info: { arguments: {} },
  get_element: { arguments: { id: "sink:api" } },
  search_elements: { arguments: { query: "orders", limit: 3 } },
  get_deployments: { arguments: { service: "sink:api" } },
  list_teams: { arguments: {} },
  list_environments: { arguments: {} },
  list_views: { arguments: { element: "sink:orders-db" } },
  get_view: { arguments: { id: "sink:orders-db-outage" } },
  find_paths: { arguments: { from: "sink:customer", to: "sink:orders-db" } },
  get_impact: { arguments: { id: "sink:orders-db", direction: "upstream" } },
  list_owned: { arguments: { team: "data" } },
  list_gaps: { arguments: { project: "sink", owner: "data" } },
  list_adrs: { arguments: { element: "sink:mailer" } },
  get_adr: { arguments: { id: "sink:0001" } },
  // The first commit with the Kitchen sink in it: the changes since then.
  get_changes: { arguments: { from: "737dd399d1b037ce5cd7a723138fc59fb90f6835", limit: 3 } },
  list_history: { arguments: { limit: 2 } },
  check: { arguments: {} },
  get_authoring_guide: { arguments: { topic: "relationships" } },
  upsert_element: { arguments: { project: "sink", kind: "service", id: "invoices", parent: "shop", fields: { name: "Invoices", technology: "Go", owner: "core" }, dry_run: true } },
  upsert_relationship: { arguments: { project: "sink", from: "reports", to: "search", fields: { description: "Looks up products in", technology: "HTTPS" }, dry_run: true } },
  remove_element: { arguments: { project: "sink", id: "catalogue", dry_run: true } },
  remove_relationship: { arguments: { project: "sink", from: "reports", to: "orders-db", dry_run: true } },
  upsert_target: { arguments: { project: "sink", id: "edge-cdn", fields: { name: "Edge CDN", kind: "cdn" }, dry_run: true } },
  remove_target: {
    arguments: { project: "sink", id: "edge-cdn", dry_run: true },
    before: { call: { tool: "upsert_target", arguments: { project: "sink", id: "edge-cdn", fields: { name: "Edge CDN", kind: "cdn" } } }, says: "Every Deployment Target in the Kitchen sink has Deployments on it, so this example first adds one with `upsert_target`." },
  },
  upsert_deployment: { arguments: { project: "sink", service: "reports", environment: "prod", target: "cluster", dry_run: true } },
  remove_deployment: { arguments: { project: "sink", service: "search", environment: "prod", target: "cloud", dry_run: true } },
  upsert_team: { arguments: { id: "billing", fields: { name: "Billing" }, dry_run: true } },
  upsert_environment: { arguments: { id: "staging", fields: { name: "Staging" }, dry_run: true } },
  upsert_view: { arguments: { project: "sink", id: "data-services", definition: { title: "Data services", level: "c2", include: ["orders-db", "events", "search"] }, dry_run: true } },
  remove_view: { arguments: { project: "sink", id: "everything", dry_run: true } },
  propose_adr: { arguments: { project: "sink", title: "Index products in Search", elements: ["search"], dry_run: true } },
  create_project: { arguments: { id: "billing", name: "Billing", owner: "core", dry_run: true } },
};

/** A tool as the server lists it, with its example and the result the example returned. */
export interface CapturedTool {
  tool: ListedTool;
  example: ToolExample & { result: Record<string, unknown> };
}

/** Everything the MCP pages show that the build captures from the running server. */
export interface Capture {
  tools: CapturedTool[];
  /** A real failed call, shown on the error page. */
  error: { call: Call; result: Record<string, unknown> };
}

/** The failed call the error page shows. */
const FAILING: Call = { tool: "get_element", arguments: { id: "sink:ap" } };

/** A client connected to a server over the Workspace at `root`. */
async function connect(root: string): Promise<Client> {
  const server = createServer({ source: checkoutSource({ root }) });
  const client = new Client({ name: "archidocs-docs", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  return client;
}

/** Every tool the client's server lists, page by page. */
async function list(client: Client): Promise<ListedTool[]> {
  const tools: ListedTool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...(page.tools as ListedTool[]));
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

/** The tools the server advertises, as an MCP client lists them. */
export async function listTools(): Promise<ListedTool[]> {
  const client = await connect(repoPath(WORKSPACE));
  try {
    return await list(client);
  } finally {
    await client.close();
  }
}

/** A tool's structured result; throws on an error result, naming the tool and the code. */
async function call(client: Client, { tool, arguments: args }: Call, what: string): Promise<Record<string, unknown>> {
  const result = await client.callTool({ name: tool, arguments: args });
  const content = (result.structuredContent ?? {}) as Record<string, unknown>;
  if (result.isError) throw new Error(`${what} returned ${String(content["code"])}: ${String(content["message"])}`);
  return content;
}

/** Paths on the machine that built the site, made relative to the repo root (or the copy standing in for it). */
function relativize(value: unknown, roots: readonly string[]): unknown {
  if (typeof value === "string") return roots.reduce((s, root) => s.split(`${root}/`).join("").split(root).join("."), value);
  if (Array.isArray(value)) return value.map((v) => relativize(v, roots));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relativize(v, roots)]));
  return value;
}

let captured: Promise<Capture> | undefined;

/**
 * Lists the tools and calls each with its example. Fails when a tool has no
 * example, when an example returns an error, and when a tool that takes
 * `dry_run` isn't called with `dry_run: true`. With the default examples,
 * runs once per build.
 */
export function captureTools(examples: Readonly<Record<string, ToolExample>> = EXAMPLES): Promise<Capture> {
  if (examples !== EXAMPLES) return capture(examples);
  captured ??= capture(examples);
  return captured;
}

async function capture(examples: Readonly<Record<string, ToolExample>>): Promise<Capture> {
  const root = repoPath("").replace(/\/$/, "");
  const client = await connect(repoPath(WORKSPACE));
  try {
    const tools = await list(client);
    const unknown = Object.keys(examples).filter((name) => !tools.some((t) => t.name === name));
    if (unknown.length > 0) throw new Error(`EXAMPLES in website/src/reference/mcp.ts names tools the server doesn't list: ${unknown.join(", ")}.`);
    const out: CapturedTool[] = [];
    for (const tool of tools) {
      const example = examples[tool.name];
      if (!example) throw new Error(`The MCP tool ${tool.name} has no example: add its input to EXAMPLES in website/src/reference/mcp.ts.`);
      if (takes(tool, "dry_run") && example.arguments["dry_run"] !== true) throw new Error(`${tool.name}'s example must pass dry_run: true, so the docs build writes nothing.`);
      const what = `${tool.name}'s example`;
      const result = example.before ? await onCopy(example.before.call, { tool: tool.name, arguments: example.arguments }, what) : await call(client, { tool: tool.name, arguments: example.arguments }, what);
      out.push({ tool, example: { ...example, result: relativize(result, [root]) as Record<string, unknown> } });
    }
    const failed = await client.callTool({ name: FAILING.tool, arguments: FAILING.arguments });
    if (!failed.isError) throw new Error(`The error page's example call, ${FAILING.tool}, didn't fail.`);
    return { tools: out, error: { call: FAILING, result: failed.structuredContent as Record<string, unknown> } };
  } finally {
    await client.close();
  }
}

/** Makes `before` for real on a copy of the Kitchen sink, at the same path under a stand-in repo root, then makes `then`. */
async function onCopy(before: Call, then: Call, what: string): Promise<Record<string, unknown>> {
  const repo = mkdtempSync(join(tmpdir(), "archidocs-mcp-example-"));
  try {
    mkdirSync(join(repo, ".git"));
    cpSync(repoPath(WORKSPACE), join(repo, WORKSPACE), { recursive: true });
    const client = await connect(join(repo, WORKSPACE));
    try {
      await call(client, before, `${what}'s first call, ${before.tool},`);
      return relativize(await call(client, then, what), [repo]) as Record<string, unknown>;
    } finally {
      await client.close();
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

/** A tool's own page. */
export const toolPath = (tool: Pick<ListedTool, "name">): string => `/${BASE}/${tool.name}/`;

const ERRORS_PATH = `/${BASE}/errors/`;
/** The hand-written pages every tool page and the error page link. */
const SEE_ALSO = ["- [Agents and MCP](/docs/concepts/agents-and-mcp/)", "- [Connect an agent over MCP](/docs/guides/agents/connect-mcp/)"];

const isWrite = (tool: ListedTool) => tool.annotations?.readOnlyHint === false;
/** Its index page, as a link: read tools or write tools. */
const indexLink = (tool: ListedTool) => (isWrite(tool) ? `[Write tools](/${BASE}/write-tools/)` : `[Read tools](/${BASE}/read-tools/)`);
const takes = (tool: ListedTool, field: string) => tool.inputSchema.properties?.[field] !== undefined;
/** The tool's title, with "destructive" for a tool that removes things. */
const titleOf = (tool: ListedTool, separator: string) => `${tool.title ?? tool.name}${tool.annotations?.destructiveHint ? `${separator}destructive` : ""}`;

/** A description's first sentence. */
const firstSentence = (description: string): string => /^[\s\S]*?[.!?](?=\s|$)/.exec(description)?.[0] ?? description;

/** The read-tools and write-tools indexes, the error page, and a page per tool. */
export function mcpPages({ tools: captured, error }: Capture): GeneratedPage[] {
  const all = captured.map((c) => c.tool);
  const read = all.filter((t) => !isWrite(t));
  const write = all.filter(isWrite);
  return [
    {
      id: `${BASE}/read-tools`,
      title: "Read tools",
      order: 1,
      description: `The ${read.length} MCP tools that query the Model without changing it.`,
      source: "src/mcp/server.ts",
      body: blocks(
        `\`archidocs mcp\` serves ${all.length} tools. These ${read.length} read the Model and never change it. Each also takes \`at\`, ${POINT_GRAMMAR}, to answer from the Model as it was then. On a checkout, any git ref works too.`,
        `Every result is \`structuredContent\` plus a compact Markdown copy. A call that fails returns \`isError\` with \`{code, message, suggestions?}\`: see [Error codes](${ERRORS_PATH}).`,
        indexTable(read),
        ...read.map(indexSection),
      ),
    },
    {
      id: `${BASE}/write-tools`,
      title: "Write tools",
      order: 2,
      description: `The ${write.length} MCP tools that work on a Workspace checkout, most of them editing its YAML.`,
      source: "src/mcp/writes.ts",
      body: blocks(
        `These ${write.length} tools need a [Workspace checkout](/docs/reference/glossary/#term-checkout) (\`archidocs mcp --workspace <dir>\`), not a published Workspace Bundle; over HTTP they also need \`--allow-writes\`. The ones that edit the YAML keep its comments and formatting, and return a unified diff.`,
        `A write that would add a check error is refused with [\`validation_failed\`](${ERRORS_PATH}#validation_failed) and the issues, each with a link to its rule's page.`,
        indexTable(write),
        ...write.map(indexSection),
      ),
    },
    errorsPage(error),
    ...captured.map((c, i) => toolPage(c, i)),
  ];
}

const indexTable = (tools: readonly ListedTool[]): string =>
  table(
    ["Tool", "What it does"],
    tools.map((t) => [`[\`${t.name}\`](${toolPath(t)})`, text(firstSentence(t.description ?? t.title ?? ""))]),
  );

/** A tool's heading on its index page, kept so `read-tools/#<tool>` links still land on it. */
const indexSection = (tool: ListedTool): string =>
  blocks(`## ${tool.name}`, `${titleOf(tool, ", ")}: [its input, output and an example](${toolPath(tool)}).`);

/** A tool's page: what it does, its input and output, the example call and its result, its errors. */
function toolPage({ tool, example }: CapturedTool, order: number): GeneratedPage {
  const write = isWrite(tool);
  const input = fieldSections(tool.inputSchema, { maxDepth: 3 });
  const output = tool.outputSchema ? fieldSections(tool.outputSchema, { maxDepth: 3 }) : [];
  const { diff, ...rest } = example.result;
  const long: string[] = [];
  const shown = shorten(typeof diff === "string" ? { ...rest, diff: "(the patch below)" } : example.result, "", long);
  return {
    id: `${BASE}/${tool.name}`,
    title: tool.name,
    order: 10 + order,
    description: tool.title ?? tool.name,
    source: write ? "src/mcp/writes.ts" : "src/mcp/server.ts",
    body: blocks(
      `**${titleOf(tool, " · ")}** · ${write ? "write tool" : "read tool"}`,
      tool.description && text(tool.description),
      "## Input",
      sections(input, "No arguments."),
      "## Output",
      sections(output, "No structured output."),
      "## Example",
      `Called over the [Kitchen sink](${GITHUB_URL}/tree/main/${WORKSPACE}) example Workspace.${example.before ? ` ${example.before.says}` : ""}`,
      "Arguments:",
      fence("json", JSON.stringify(example.arguments, null, 2)),
      "Result:",
      fence("json", JSON.stringify(shown, null, 2)),
      long.length > 0 && `${[...new Set(long)].map((p) => `\`${p}\``).join(" and ")} ${new Set(long).size === 1 ? "is" : "are"} cut short here, after ${SHOWN_CHARS} characters.`,
      typeof diff === "string" && "The `diff`, as a patch:",
      typeof diff === "string" && fence("diff", diff),
      "## Errors",
      errorsSection(tool),
      "## See also",
      [`- ${indexLink(tool)}`, `- [Error codes](${ERRORS_PATH})`, ...SEE_ALSO].join("\n"),
    ),
  };
}

/** How much of a long string an example result shows. */
const SHOWN_CHARS = 300;

/** A result with each string longer than `SHOWN_CHARS` cut short, collecting the paths of those it cut. */
function shorten(value: unknown, path: string, cut: string[]): unknown {
  if (typeof value === "string" && value.length > SHOWN_CHARS) {
    cut.push(path);
    return `${value.slice(0, SHOWN_CHARS)}…`;
  }
  if (Array.isArray(value)) return value.map((v) => shorten(v, `${path}[]`, cut));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v, path ? `${path}.${k}` : k, cut)]));
  return value;
}

/** Field tables: the fields always there, then one table per variant of a union. */
const sections = (list: readonly FieldSection[], none: string): string =>
  list.every((s) => s.rows.length === 0)
    ? none
    : blocks(...list.flatMap((s) => [s.when && `**${s.when}**`, s.rows.length > 0 ? fieldTable(s.rows) : "No other fields."]));

/**
 * The codes a tool can return, each with when, read off its input: a tool
 * that names something can find nothing, one with a history `scope` can find
 * two things, and so on. `get_authoring_guide` reads no Workspace.
 */
export function toolErrors(tool: ListedTool): { code: ErrorCode; when: string }[] {
  const write = isWrite(tool);
  const history = takes(tool, "scope_kind");
  const readsWorkspace = tool.name !== "get_authoring_guide";
  // The guide takes `at` like every read tool, but ships with the server, so it ignores it.
  const at = readsWorkspace && takes(tool, "at");
  const names = write ? takes(tool, "project") : (tool.inputSchema.required?.length ?? 0) > 0 || at || takes(tool, "topic");
  const pair = write && ((takes(tool, "from") && takes(tool, "to")) || (takes(tool, "service") && takes(tool, "target")));
  const errors: ({ code: ErrorCode; when: string } | false)[] = [
    { code: "invalid_input", when: "the arguments don't fit the input above." },
    names && { code: "not_found", when: `${write ? "the Project, or an id it names," : `an id or name${at ? ", or the point in history given as `at`," : ""}`} matches nothing${at ? ", or a sha prefix starts more than one Revision, with the candidates" : ""}.` },
    history && { code: "ambiguous", when: "`scope` names both a Project and an Element; pass `scope_kind`." },
    pair && { code: "ambiguous", when: "the arguments match more than one Relationship or Deployment." },
    takes(tool, "dry_run") && { code: "validation_failed", when: "the write would add a check error. Nothing is written." },
    write && { code: "read_only", when: "the server reads a published Workspace Bundle, or serves HTTP without `--allow-writes`." },
    readsWorkspace && { code: "source_unavailable", when: "the server can't read the Workspace." },
    readsWorkspace && (history || at) && { code: "history_unavailable", when: `the Workspace has no history to read${history ? "" : " at `at`"}.` },
  ];
  return errors.filter((e): e is { code: ErrorCode; when: string } => e !== false);
}

function errorsSection(tool: ListedTool): string {
  return blocks(
    "A call that fails returns `isError: true`, with `{code, message, suggestions?}` as `structuredContent`. This tool returns:",
    toolErrors(tool)
      .map((e) => `- [\`${e.code}\`](${ERRORS_PATH}#${e.code}) when ${e.when}`)
      .join("\n"),
    `[Error codes](${ERRORS_PATH}) says what to do about each.`,
  );
}

function errorsPage(error: Capture["error"]): GeneratedPage {
  return {
    id: `${BASE}/errors`,
    title: "Error codes",
    order: 3,
    description: "The codes an MCP tool returns when a call fails, and what to do about each.",
    source: "src/mcp/errors.ts",
    body: blocks(
      "A tool call that fails returns a result with `isError: true`. Its `structuredContent` is `{code, message, suggestions?}`, and some codes add fields of their own. Only a malformed request, such as an unknown tool, is a protocol error instead.",
      `Asked for an Element with a typo in its id, \`${error.call.tool}\` over the Kitchen sink returns:`,
      fence("json", JSON.stringify(error.result, null, 2)),
      table(
        ["Code", "Meaning"],
        Object.entries(ERROR_CODES).map(([c, e]) => [`[\`${c}\`](#${c})`, text(e.meaning)]),
      ),
      ...Object.entries(ERROR_CODES).flatMap(([c, e]) => [`## \`${c}\``, text(e.meaning), `**What to do:** ${text(e.action)}`]),
      "## See also",
      ["- [Read tools](/docs/reference/mcp/read-tools/)", "- [Write tools](/docs/reference/mcp/write-tools/)", ...SEE_ALSO].join("\n"),
    ),
  };
}
