import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { archidocsArgs, checkCode, checkMarkdown, commandsInBlock, commandsInConfig } from "../src/lib/command-lines.ts";
import { repoPath } from "../src/lib/repo.ts";

describe("archidocs command lines", () => {
  it("finds the arguments after archidocs, behind a prompt or a runner", () => {
    expect(archidocsArgs("archidocs check --strict")).toEqual(["check", "--strict"]);
    expect(archidocsArgs("$ npx archidocs@1.2.0 export digital:outage --out 'my file.svg'")).toEqual(["export", "digital:outage", "--out", "my file.svg"]);
    expect(archidocsArgs("pnpm exec archidocs build --out site > log.txt")).toEqual(["build", "--out", "site"]);
    expect(archidocsArgs("archidocs-authoring")).toBeUndefined();
    expect(archidocsArgs("archidocs")).toBeUndefined();
    expect(archidocsArgs("git commit")).toBeUndefined();
  });

  it("finds a command another tool runs after its --", () => {
    expect(archidocsArgs("claude mcp add --scope project archidocs -- archidocs mcp --workspace archidocs")).toEqual(["mcp", "--workspace", "archidocs"]);
    expect(archidocsArgs("codex mcp add archidocs -- npx -y archidocs mcp")).toEqual(["mcp"]);
    expect(archidocsArgs("claude mcp add archidocs -- other-server --flag")).toBeUndefined();
  });

  it("reads each MCP server entry in a JSON or TOML config as a command line", () => {
    const json = '{ "mcpServers": { "archidocs": { "args": ["-y", "archidocs", "mcp", "--workspace", "my [docs]"], "type": "stdio", "command": "npx" }, "other": { "subcommand": "x", "env": {} } } }';
    expect(commandsInConfig(json, "json")).toEqual([["npx", "-y", "archidocs", "mcp", "--workspace", "my [docs]"]]);
    expect(checkCode(json, { lang: "json" })).toEqual([]);
    const toml = ["[mcp_servers.archidocs]", 'args = ["mcp", "--workspace", "archidocs"]', 'command = "archidocs"', "", "[mcp_servers.other]", 'url = "http://127.0.0.1:3737/mcp"'].join("\n");
    expect(commandsInConfig(toml, "toml")).toEqual([["archidocs", "mcp", "--workspace", "archidocs"]]);
    expect(checkCode('[a]\ncommand = "npx"\nargs = ["-y", "archidocs", "mpc"]', { lang: "toml" })[0]?.line).toBe("npx -y archidocs mpc");
    expect(checkCode(toml, { lang: "toml" })).toEqual([]);
    expect(checkCode('{ "command": "archidocs", "args": ["mcp", "--workspce", "archidocs"] }', { lang: "json" })[0]?.message).toMatch(/--workspce/);
    expect(checkCode('{ "command": "archidocs", "args": ["mcp", "--nope"] }', { lang: "yaml" })).toEqual([]);
  });

  it("drops synopsis brackets, keeping what they hold", () => {
    expect(archidocsArgs("archidocs init [--skill [--workspace <dir>]]")).toEqual(["init", "--skill", "--workspace", "<dir>"]);
  });

  it("splits a shell block into commands", () => {
    expect(commandsInBlock("archidocs check && \\\n  archidocs build --out site # build it\nnpm i; archidocs check --format json | jq .")).toEqual([
      "archidocs check",
      "archidocs build --out site",
      "npm i",
      "archidocs check --format json",
      "jq .",
    ]);
  });

  it("reports an unknown command or flag, and a flag missing its value", () => {
    expect(checkCode("archidocs check --strict", { inline: true })).toEqual([]);
    expect(checkCode("archidocs chek", { inline: true })).toEqual([{ line: "archidocs chek", message: 'Unknown command "chek".' }]);
    expect(checkCode("npx archidocs export --all-saved --oot dir", { lang: "bash" })[0]?.message).toMatch(/Unknown option '--oot'/);
    expect(checkCode("archidocs build --out", { lang: "sh" })[0]?.message).toMatch(/--out/);
  });

  it("reads only shell code blocks", () => {
    expect(checkCode("archidocs build [--nope]", { lang: "text" })).toEqual([]);
    expect(checkCode("archidocs build --nope", { lang: "yaml" })).toEqual([]);
    expect(checkCode("archidocs build --nope", { lang: "console" })).toHaveLength(1);
  });

  it("checks a Markdown document's code blocks and inline code", () => {
    const markdown = ["Run `archidocs check --strct`.", "", "```bash", "archidocs dev --port 4000", "archidocs dev --prot 4000", "```", "", "```text", "archidocs nope", "```"].join("\n");
    expect(checkMarkdown(markdown).map((p) => p.line)).toEqual(["archidocs dev --prot 4000", "archidocs check --strct"]);
  });

  it("finds no unknown command line in the README", () => {
    expect(checkMarkdown(readFileSync(repoPath("README.md"), "utf8"))).toEqual([]);
  });
});
