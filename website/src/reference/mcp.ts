/**
 * The MCP tool reference. The build starts the MCP server in-process over
 * the Kitchen sink checkout, calls `listTools` like any client, and renders
 * each tool's title, description and input and output schemas, split by the
 * `readOnlyHint` annotation into read and write tools.
 */
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { checkoutSource, createServer } from "../../../src/mcp/index.ts";
import { repoPath } from "../lib/repo.ts";
import { fieldRows, fieldTable, type JsonSchema } from "./json-schema.ts";
import { blocks, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/mcp";

export interface ListedTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

/** The tools the server advertises, as an MCP client lists them. */
export async function listTools(): Promise<ListedTool[]> {
  const server = createServer({ source: checkoutSource({ root: repoPath("examples/kitchen-sink/archidocs") }) });
  const client = new Client({ name: "archidocs-docs", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    const tools: ListedTool[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...(page.tools as ListedTool[]));
      cursor = page.nextCursor;
    } while (cursor);
    return tools;
  } finally {
    await client.close();
  }
}

export const toolPath = (tool: ListedTool): string => `/${BASE}/${isWrite(tool) ? "write-tools" : "read-tools"}/#${tool.name}`;

const isWrite = (tool: ListedTool) => tool.annotations?.readOnlyHint === false;

export async function mcpPages(tools?: ListedTool[]): Promise<GeneratedPage[]> {
  const all = tools ?? (await listTools());
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
        `\`archidocs mcp\` serves ${all.length} tools. These ${read.length} read the Model and never change it. Each also takes \`at\`, a git ref or a date, to answer from the Model as it was then.`,
        "Every result is `structuredContent` plus a compact Markdown copy. A lookup that fails returns `isError` with `{code, message, suggestions?}`.",
        ...read.map(toolSection),
      ),
    },
    {
      id: `${BASE}/write-tools`,
      title: "Write tools",
      order: 2,
      description: `The ${write.length} MCP tools that work on a Workspace checkout, most of them editing its YAML.`,
      source: "src/mcp/writes.ts",
      body: blocks(
        `These ${write.length} tools need a Workspace checkout (\`archidocs mcp --workspace <dir>\`), not a published Bundle; over HTTP they also need \`--allow-writes\`. The ones that edit the YAML keep its comments and formatting, and return a unified diff.`,
        "A write that would add a check error is refused with `validation_failed` and the issues, each with a link to its rule's page.",
        ...write.map(toolSection),
      ),
    },
  ];
}

function toolSection(tool: ListedTool): string {
  const input = fieldRows(tool.inputSchema, { maxDepth: 3 });
  const output = tool.outputSchema ? fieldRows(tool.outputSchema, { maxDepth: 2 }) : [];
  return blocks(
    `## ${tool.name}`,
    tool.title && `**${tool.title}**${tool.annotations?.destructiveHint ? " · destructive" : ""}`,
    tool.description && text(tool.description),
    "**Input**",
    input.length > 0 ? fieldTable(input) : "No arguments.",
    output.length > 0 && "**Output**",
    output.length > 0 && fieldTable(output),
  );
}
