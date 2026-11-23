import { request } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { describe, expect, it, onTestFinished } from "vitest";
import { bundleSource, checkoutSource, serveHttp, type ServeHttpOptions } from "../../src/mcp/index.ts";
import { bundleText, serveBundleSite } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { tools } from "../support/mcp.ts";
import { writeWorkspace } from "../support/workspace.ts";

/** Starts the HTTP server on a free port and connects a Streamable HTTP client to it. */
async function connectHttp(options: ServeHttpOptions) {
  const http = await serveHttp({ port: 0, ...options });
  onTestFinished(() => http.close());
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(http.url)));
  onTestFinished(() => client.close());
  return { http, client, ...tools(client) };
}

/** A raw request, so tests can send the Host and Origin headers a browser would. */
function raw(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const req = request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end(body);
  });
}

describe("archidocs mcp over Streamable HTTP", () => {
  it("serves the tools at /mcp on localhost", async () => {
    const { root } = await writeWorkspace(validWorkspace);
    const { http, call } = await connectHttp({ source: checkoutSource({ root }) });
    expect(http.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    expect((await call("get_element", { id: "shop:web" })).structuredContent).toMatchObject({ element: { name: "Web" } });
  });

  it("turns write tools off unless writes are allowed", async () => {
    const { root } = await writeWorkspace(validWorkspace);
    const off = await connectHttp({ source: checkoutSource({ root }) });
    expect((await off.call("get_workspace_info")).structuredContent).toMatchObject({ writesAllowed: false });
    expect((await off.call("check")).structuredContent).toMatchObject({ code: "read_only", message: expect.stringContaining("--allow-writes") });

    const on = await connectHttp({ source: checkoutSource({ root }), allowWrites: true });
    expect((await on.call("get_workspace_info")).structuredContent).toMatchObject({ writesAllowed: true });
    expect((await on.call("check")).structuredContent).toMatchObject({ summary: { errors: 0 } });
  });

  it("keeps a Bundle source read-only even with writes allowed", async () => {
    const site = await serveBundleSite(await bundleText(validWorkspace, "a".repeat(40)));
    const { call } = await connectHttp({ source: bundleSource({ location: site.url }), allowWrites: true });
    expect((await call("get_workspace_info")).structuredContent).toMatchObject({ source: { kind: "bundle" }, writesAllowed: false });
    expect((await call("check")).structuredContent).toMatchObject({ code: "read_only" });
  });

  it.each(["0.0.0.0", "::", "192.168.1.20", "example.com"])("refuses to bind to %s", async (host) => {
    const { root } = await writeWorkspace(validWorkspace);
    await expect(serveHttp({ source: checkoutSource({ root }), host, port: 0 })).rejects.toThrow(/only binds to localhost/);
  });

  it("binds to the other loopback names", async () => {
    const { root } = await writeWorkspace(validWorkspace);
    for (const [host, url] of [["localhost", /^http:\/\/localhost:\d+\/mcp$/], ["::1", /^http:\/\/\[::1\]:\d+\/mcp$/]] as const) {
      const { http, call } = await connectHttp({ source: checkoutSource({ root }), host });
      expect(http.url).toMatch(url);
      expect((await call("list_teams")).isError).toBeFalsy();
    }
  });

  it("rejects requests whose Host or Origin isn't localhost, against DNS rebinding", async () => {
    const { root } = await writeWorkspace(validWorkspace);
    const { http } = await connectHttp({ source: checkoutSource({ root }) });
    expect(await raw(http.url, { host: "attacker.example.com" })).toBe(403);
    expect(await raw(http.url, { origin: "https://attacker.example.com" })).toBe(403);
    expect(await raw(http.url, { origin: "http://localhost:5173" })).toBe(200);
    expect(await raw(http.url.replace(/\/mcp$/, "/other"), {})).toBe(404);
  });
});
