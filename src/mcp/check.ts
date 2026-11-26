import { InMemoryTransport, LATEST_PROTOCOL_VERSION, type JSONRPCMessage } from "@modelcontextprotocol/server";
import { startupLine } from "./announce.ts";
import { createServer, type ServerOptions } from "./server.ts";

const TIMEOUT_MS = 30_000;

export interface CheckResult {
  ok: boolean;
  /** What the check found, to print on stdout. */
  lines: string[];
  /** Why it failed, when it did. */
  error?: string;
}

/**
 * `archidocs mcp --check`: runs the server these options would start behind
 * an in-process client, as an agent would, and reports what it serves. It
 * does `initialize`, `tools/list` and one read (`list_teams`), so it fails
 * when the server can't start or can't read its source.
 */
export async function checkServer(options: ServerOptions & { version: string }): Promise<CheckResult> {
  const lines = [await startupLine({ version: options.version, transport: "check", source: options.source, writesAllowed: options.source.writesAllowed })];
  const server = createServer(options);
  const [client, end] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JSONRPCMessage) => void>();
  client.onmessage = (message) => {
    const id = (message as { id?: number }).id;
    if (id !== undefined) pending.get(id)?.(message);
  };
  let next = 0;
  const request = async (method: string, params: Record<string, unknown>) => {
    const id = ++next;
    const reply = new Promise<JSONRPCMessage>((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => reject(new Error(`${method} got no answer in ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS).unref();
    });
    await client.send({ jsonrpc: "2.0", id, method, params });
    const message = (await reply) as { result?: Record<string, unknown>; error?: { message: string } };
    if (message.error) throw new Error(`${method} failed: ${message.error.message}`);
    return message.result!;
  };

  try {
    await server.connect(end);
    await client.start();
    await request("initialize", { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "archidocs-check", version: options.version } });
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    const { tools } = (await request("tools/list", {})) as { tools: unknown[] };
    const teams = (await request("tools/call", { name: "list_teams", arguments: {} })) as { isError?: boolean; structuredContent?: { code?: string; message?: string } };
    if (teams.isError) throw new Error(`list_teams failed: ${teams.structuredContent?.code}: ${teams.structuredContent?.message}`);
    lines.push(`ok: ${tools.length} tools; list_teams answered`);
    return { ok: true, lines };
  } catch (error) {
    return { ok: false, lines, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await server.close();
  }
}
