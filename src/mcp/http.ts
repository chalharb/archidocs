import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { createServer, type ServerOptions } from "./server.ts";

export interface ServeHttpOptions extends ServerOptions {
  /** A loopback name: `127.0.0.1` (the default), `localhost` or `::1`. Anything else is refused. */
  host?: string;
  /** The port to listen on; 0 picks a free one. */
  port?: number;
  /** Write tools are off over HTTP unless this is true. */
  allowWrites?: boolean;
}

export interface HttpServer {
  /** The MCP endpoint, e.g. `http://127.0.0.1:3737/mcp`. */
  url: string;
  close(): Promise<void>;
}

/** The hosts the HTTP server will bind to. It has no auth, so it never listens beyond this machine. */
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

export const DEFAULT_PORT = 3737;

/**
 * Serves the MCP server over Streamable HTTP at `/mcp`, bound to localhost.
 * Each request gets a fresh, stateless server instance over the one shared
 * Source. Requests whose Host or Origin header isn't localhost are refused,
 * so a web page can't reach the server through DNS rebinding. Write tools
 * are off unless `allowWrites` is set.
 */
export async function serveHttp({ host = "127.0.0.1", port = DEFAULT_PORT, allowWrites = false, ...options }: ServeHttpOptions): Promise<HttpServer> {
  if (!LOOPBACK.has(host)) {
    throw new Error(`The HTTP server only binds to localhost (127.0.0.1, localhost or ::1), not "${host}": it has no authentication.`);
  }
  const handler = createMcpHandler(() => createServer({ ...options, allowWrites }));
  const allowedHosts = localhostAllowedHostnames();
  const allowedOrigins = localhostAllowedOrigins();

  const server = createHttpServer((req, res) => {
    void (async () => {
      const abort = new AbortController();
      res.on("close", () => abort.abort());
      const request = toRequest(req, base, abort.signal);
      const response =
        hostHeaderValidationResponse(request, allowedHosts) ??
        originValidationResponse(request, allowedOrigins) ??
        (new URL(request.url).pathname === "/mcp" ? await handler.fetch(request) : new Response("Not found", { status: 404 }));
      await send(response, res);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const bound = (server.address() as AddressInfo).port;
  const base = `http://${host.includes(":") ? `[${host}]` : host}:${bound}`;

  return {
    url: `${base}/mcp`,
    async close() {
      await handler.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** A web-standard Request for a Node one. The URL is built on the bound address, never on the client's Host header. */
function toRequest(req: IncomingMessage, base: string, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) headers.append(name, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(new URL(req.url ?? "/", base), {
    method: req.method,
    headers,
    signal,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
  } as RequestInit);
}

/** Writes a web-standard Response to Node, streaming the body (SSE included) as it comes. */
async function send(response: Response, res: ServerResponse): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    res.end();
    return;
  }
  for await (const chunk of response.body) {
    if (res.destroyed) break;
    res.write(chunk);
  }
  res.end();
}
