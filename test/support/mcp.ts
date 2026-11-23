import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { onTestFinished } from "vitest";
import { checkoutSource, createServer, type ServerOptions, type Source } from "../../src/mcp/index.ts";
import { writeWorkspace, type Files } from "./workspace.ts";

/** A tool result as the client sees it. */
export type ToolResult = { content: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

/** `call` and `text` helpers over a connected client. */
export function tools(client: Client) {
  /** Calls a tool and returns its whole result. */
  const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as ToolResult;
  /** The tool result's Markdown text copy. */
  const text = (result: ToolResult) => result.content.map((c) => c.text ?? "").join("\n");
  return { call, text };
}

/** Starts the MCP server over `source` and connects an in-memory client to it. */
export async function connectTo(source: Source, options: Omit<ServerOptions, "source"> = {}) {
  const server = createServer({ ...options, source });
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  onTestFinished(() => client.close());
  return { client, ...tools(client) };
}

/**
 * Writes a fixture Workspace into a temp git repo, commits it, starts the MCP
 * server over that checkout and connects an in-memory client to it.
 */
export async function connect(files: Files, options: Omit<ServerOptions, "source"> = {}) {
  const { repoRoot, root } = await writeWorkspace(files);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "Fixture");
  const commit = git("rev-parse", "HEAD");
  return { ...(await connectTo(checkoutSource({ root }), options)), repoRoot, root, commit };
}
