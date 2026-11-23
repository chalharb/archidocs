import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { onTestFinished } from "vitest";
import { checkoutSource, createServer, type ServerOptions } from "../../src/mcp/index.ts";
import { writeWorkspace, type Files } from "./workspace.ts";

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

  const server = createServer({ ...options, source: checkoutSource({ root }) });
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  onTestFinished(() => client.close());

  /** Calls a tool and returns its whole result. */
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    return result as { content: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
  };
  /** The tool result's Markdown text copy. */
  const text = (result: Awaited<ReturnType<typeof call>>) => result.content.map((c) => c.text ?? "").join("\n");

  return { client, call, text, repoRoot, root, commit };
}
