import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
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

const { version } = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };

/** Like `serve`, keeping what the server writes to stderr; `env` is added to the server's environment. */
async function serveLogged(cwd: string, env: Record<string, string>, ...args: string[]) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, "mcp", ...args], cwd, env: { ...(process.env as Record<string, string>), ...env }, stderr: "pipe" });
  let stderr = "";
  transport.stderr!.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  await client.connect(transport);
  onTestFinished(() => client.close());
  /** Resolves with stderr once it has a line matching `re`. */
  const waitFor = async (re: RegExp) => {
    for (let i = 0; i < 200 && !re.test(stderr); i++) await new Promise((r) => setTimeout(r, 25));
    expect(stderr).toMatch(re);
    return stderr;
  };
  return { client, stderr: () => stderr, waitFor };
}

const run = (cwd: string, ...args: string[]) => promisify(execFile)(process.execPath, [cli, "mcp", ...args], { cwd });

describe("archidocs mcp says it is up", () => {
  it("announces on stderr, once loaded, the version, the Workspace, its size and check results", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const { client, waitFor } = await serveLogged(repoRoot, {});
    const line = await waitFor(/MCP server/);
    expect(line).toContain(`archidocs ${version} MCP server (stdio): Workspace ${await realpath(root)} — 2 Projects, 4 Elements; check: 0 errors, 0 warnings; writes on\n`);
    expect(client.getServerVersion()).toMatchObject({ name: "archidocs", version });
  });

  it("reports a source it can't load, and keeps serving", async () => {
    const missing = join(await mkdtemp(join(tmpdir(), "archidocs-site-")), "nothing-here");
    const { client, waitFor } = await serveLogged(tmpdir(), {}, "--bundle", missing);
    const line = await waitFor(/can't load/);
    expect(line).toContain(`archidocs ${version} MCP server (stdio): Bundle `);
    expect(line).toMatch(/Bundle .*nothing-here.* can't load it: .+; tools return source_unavailable until it loads\n/);
    expect((await client.callTool({ name: "get_workspace_info", arguments: {} })).structuredContent).toMatchObject({ code: "source_unavailable" });
  });

  it("logs each write tool call, and read calls only with ARCHIDOCS_LOG=debug", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const quiet = await serveLogged(repoRoot, {});
    await quiet.waitFor(/MCP server/);
    await quiet.client.callTool({ name: "get_element", arguments: { id: "shop:web" } });
    await quiet.client.callTool({ name: "upsert_element", arguments: { project: "shop", kind: "service", id: "cart", fields: { name: "Cart" }, file: "services.yaml" } });
    await quiet.client.callTool({ name: "upsert_element", arguments: { project: "shop", kind: "service", id: "bad", fields: { name: "Bad", owner: "no-such-team" } } });
    const log = await quiet.waitFor(/upsert_element shop:bad/);
    expect(log).toContain("upsert_element shop:cart: created archidocs/shop/services.yaml\n");
    expect(log).toMatch(/upsert_element shop:bad: refused \(validation_failed\)\n/);
    expect(log).not.toContain("get_element");

    const debug = await serveLogged(repoRoot, { ARCHIDOCS_LOG: "debug" });
    await debug.client.callTool({ name: "get_element", arguments: { id: "shop:web" } });
    await debug.waitFor(/get_element shop:web: ok\n/);
  });
});

describe("archidocs mcp --check", () => {
  it("runs the server it would start against an in-process client, and exits 0", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const { stdout } = await run(repoRoot, "--workspace", "archidocs", "--check");
    expect(stdout).toContain(`archidocs ${version} MCP server (check): Workspace ${await realpath(root)} — 2 Projects, 4 Elements; check: 0 errors, 0 warnings; writes on\n`);
    expect(stdout).toMatch(/^ok: \d+ tools; list_teams answered\n/m);
  });

  it("exits 2 with the reason when the server can't serve its source", async () => {
    const missing = join(await mkdtemp(join(tmpdir(), "archidocs-site-")), "nothing-here");
    await expect(run(tmpdir(), "--bundle", missing, "--check")).rejects.toMatchObject({ code: 2, stderr: expect.stringMatching(/list_teams failed: source_unavailable: .+/) });
  });

  it("exits 2 for a --workspace folder that doesn't exist, rather than finding a Workspace above it", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    await expect(run(repoRoot, "--workspace", "archidocs/nope", "--check")).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining('--workspace "archidocs/nope" is not a folder') });
  });

  it("exits 2 with --http", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    await expect(run(repoRoot, "--http", "--check")).rejects.toMatchObject({ code: 2, stderr: expect.stringContaining("--check runs the stdio server; leave out --http") });
  });
});

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

  it("serves and edits the Workspace named by --workspace from a separate folder, such as a code repo", async () => {
    const { root } = await writeWorkspace(validWorkspace);
    const codeRepo = await mkdtemp(join(tmpdir(), "archidocs-code-"));
    const client = await serve(codeRepo, "--workspace", root);

    const written = await client.callTool({ name: "upsert_element", arguments: { project: "shop", kind: "service", id: "cart", fields: { name: "Cart" }, file: "services.yaml" } });
    expect(written.structuredContent).toMatchObject({ action: "created", id: "shop:cart" });
    expect(await readFile(join(root, "shop/services.yaml"), "utf8")).toContain("  cart:\n    name: Cart\n");
    const read = await client.callTool({ name: "get_element", arguments: { id: "shop:cart" } });
    expect(read.structuredContent).toMatchObject({ element: { name: "Cart" } });
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
