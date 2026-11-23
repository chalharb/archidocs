import { execFile, spawn } from "node:child_process";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it, onTestFinished } from "vitest";
import { bundleText } from "../support/bundle-site.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

const cli = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));

async function serve(cwd: string, ...args: string[]) {
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp", ...args], cwd, stderr: "pipe" }));
  onTestFinished(() => client.close());
  return client;
}

/** Runs `archidocs mcp --http …` and connects once it prints the URL it listens on. */
async function serveHttp(cwd: string, ...args: string[]) {
  const child = spawn(process.execPath, [cli, "mcp", "--http", "--port", "0", ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  onTestFinished(() => {
    child.kill();
  });
  const url = await new Promise<string>((resolve, reject) => {
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
      const match = /http:\/\/\S+\/mcp/.exec(err);
      if (match) resolve(match[0]);
    });
    child.on("exit", (code) => reject(new Error(`exited ${code}: ${err}`)));
  });
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  onTestFinished(() => client.close());
  return { client, url };
}

const run = (cwd: string, ...args: string[]) => promisify(execFile)(process.execPath, [cli, "mcp", ...args], { cwd });

describe("archidocs mcp", () => {
  it("serves the Workspace found from the current folder over stdio", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const client = await serve(join(repoRoot, "archidocs", "shop"));
    const result = await client.callTool({ name: "get_workspace_info", arguments: {} });
    expect(result.structuredContent).toMatchObject({ source: { kind: "checkout", root: await realpath(root) }, counts: { elements: 4 } });
  });

  it("takes the Workspace folder and a viewer base URL as options", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const client = await serve(repoRoot, "--workspace", join(repoRoot, "archidocs"), "--viewer-url", "https://arch.example.com/");
    const result = await client.callTool({ name: "get_element", arguments: { id: "shop:web" } });
    expect(result.structuredContent).toMatchObject({ element: { name: "Web" }, viewerUrl: "https://arch.example.com/#/element/shop:web" });
  });

  it("exits with 2 when there is no Workspace", async () => {
    const { repoRoot } = await writeWorkspace({});
    const run = promisify(execFile)(process.execPath, [cli, "mcp"], { cwd: repoRoot });
    await expect(run).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining("No workspace.yaml found") });
  });

  it("serves a Bundle file with --bundle, read-only", async () => {
    const out = await mkdtemp(join(tmpdir(), "archidocs-site-"));
    await writeFile(join(out, "workspace.bundle.json"), await bundleText(validWorkspace, "a".repeat(40)));
    const client = await serve(tmpdir(), "--bundle", out);
    const info = await client.callTool({ name: "get_workspace_info", arguments: {} });
    expect(info.structuredContent).toMatchObject({ source: { kind: "bundle", location: join(out, "workspace.bundle.json") }, writesAllowed: false });
    expect((await client.callTool({ name: "check", arguments: {} })).structuredContent).toMatchObject({ code: "read_only" });
  });

  it("serves Streamable HTTP on localhost with --http, writes off unless --allow-writes", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const off = await serveHttp(repoRoot);
    expect(off.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    expect((await off.client.callTool({ name: "check", arguments: {} })).structuredContent).toMatchObject({ code: "read_only" });

    const on = await serveHttp(repoRoot, "--allow-writes");
    expect((await on.client.callTool({ name: "check", arguments: {} })).structuredContent).toMatchObject({ summary: { errors: 0 } });
  });

  it("exits with 2 for a non-localhost --host", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    await expect(run(repoRoot, "--http", "--host", "0.0.0.0")).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining("only binds to localhost") });
  });

  it.each([
    [["--bundle", "x.json", "--workspace", "."], "not both"],
    [["--allow-writes"], "--allow-writes only applies with --http"],
    [["--host", "localhost"], "--host and --port only apply with --http"],
    [["--http", "--port", "http"], "is not a port"],
  ])("exits with 2 for %j", async (args, message) => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    await expect(run(repoRoot, ...args)).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining(message) });
  });
});
