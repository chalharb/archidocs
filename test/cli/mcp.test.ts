import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it, onTestFinished } from "vitest";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

const cli = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));

async function serve(cwd: string, ...args: string[]) {
  const client = new Client({ name: "archidocs-test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli, "mcp", ...args], cwd, stderr: "pipe" }));
  onTestFinished(() => client.close());
  return client;
}

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
});
