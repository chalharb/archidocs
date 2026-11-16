import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runProgram } from "../../src/cli/program.js";
import type { Io } from "../../src/cli/io.js";
import type { SiteData } from "../../src/core/types.js";

function recorder() {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = { log: (m) => out.push(m), error: (m) => err.push(m) };
  return { io, out, err };
}

let cwd: string;
let viewerDir: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "archidocs-cli-"));
  viewerDir = await mkdtemp(path.join(tmpdir(), "archidocs-viewer-"));
  await writeFile(path.join(viewerDir, "index.html"), "<div id=root></div>");
});

const run = (argv: string[], io: Io) => runProgram(argv, { io, cwd, viewerDir });

describe("init", () => {
  it("writes a starter config and a model that builds", async () => {
    const { io } = recorder();
    expect(await run(["init"], io)).toBe(0);
    expect(existsSync(path.join(cwd, "archidocs.config.ts"))).toBe(true);
    expect(existsSync(path.join(cwd, "architectures/example.json"))).toBe(true);
    // The package itself is not installed in the temp folder, so stand in for its helper.
    const configFile = path.join(cwd, "archidocs.config.ts");
    const source = await readFile(configFile, "utf8");
    await writeFile(
      configFile,
      source.replace(
        'import { defineConfig } from "archidocs";',
        "const defineConfig = <T>(config: T) => config;",
      ),
    );
    expect(await run(["build"], recorder().io)).toBe(0);
  });

  it("refuses to overwrite an existing config", async () => {
    await writeFile(path.join(cwd, "archidocs.config.json"), "{}");
    const { io, err } = recorder();
    expect(await run(["init"], io)).toBe(1);
    expect(err[0]).toContain("already exists");
  });

  it("refuses to overwrite an existing starter model", async () => {
    await mkdir(path.join(cwd, "architectures"));
    await writeFile(path.join(cwd, "architectures/example.json"), "{}");
    const { io, err } = recorder();
    expect(await run(["init"], io)).toBe(1);
    expect(err[0]).toContain("architectures/example.json");
  });
});

describe("build", () => {
  async function config(extra = "") {
    await writeFile(
      path.join(cwd, "archidocs.config.json"),
      JSON.stringify({ name: "demo", model: "m/*.json", ...(extra ? JSON.parse(extra) : {}) }),
    );
    await mkdir(path.join(cwd, "m"));
  }

  it("copies the viewer and writes the model as a data file", async () => {
    await config('{"title":"Demo","site":{"base":"/docs/"}}');
    await writeFile(
      path.join(cwd, "m/a.json"),
      JSON.stringify({ nodes: [], metadata: { views: [{ id: "v", title: "View" }] } }),
    );
    expect(await run(["build", "--out", "site"], recorder().io)).toBe(0);
    expect(await readFile(path.join(cwd, "site/index.html"), "utf8")).toContain("root");
    const data = JSON.parse(
      await readFile(path.join(cwd, "site/archidocs-data.json"), "utf8"),
    ) as SiteData;
    expect(data).toMatchObject({ name: "demo", title: "Demo", base: "/docs/" });
    expect(data.files[0]?.views[0]?.title).toBe("View");
  });

  it("still builds when one file is invalid and records its errors", async () => {
    await config();
    await writeFile(path.join(cwd, "m/bad.json"), "{ nope");
    await writeFile(path.join(cwd, "m/good.json"), JSON.stringify({ nodes: [] }));
    const { io, err } = recorder();
    expect(await run(["build"], io)).toBe(0);
    expect(err[0]).toContain("m/bad.json");
    const data = JSON.parse(
      await readFile(path.join(cwd, "archidocs-site/archidocs-data.json"), "utf8"),
    ) as SiteData;
    expect(data.files.find((f) => f.file === "m/bad.json")?.errors).toHaveLength(1);
  });

  it("fails and names the field when the config is invalid", async () => {
    await writeFile(path.join(cwd, "archidocs.config.json"), '{"name":"x"}');
    const { io, err } = recorder();
    expect(await run(["build"], io)).toBe(1);
    expect(err[0]).toContain("model is required");
  });

  it("refuses an output folder that contains the workspace", async () => {
    await config();
    const { io, err } = recorder();
    expect(await run(["build", "--out", "."], io)).toBe(1);
    expect(err[0]).toContain("would contain the workspace");
  });
});

describe("stubbed commands", () => {
  it.each(["validate", "dev"])("%s exits cleanly", async (command) => {
    expect(await run([command], recorder().io)).toBe(0);
  });
});

describe("argument handling", () => {
  it("fails on an unknown command", async () => {
    const { io, err } = recorder();
    expect(await run(["bogus"], io)).toBe(1);
    expect(err[0]).toContain("Unknown command");
  });

  it("fails when no command is given", async () => {
    const { io, err } = recorder();
    expect(await run([], io)).toBe(1);
    expect(err[0]).toContain("No command");
  });

  it("exits cleanly for help and version", async () => {
    expect(await run(["--help"], recorder().io)).toBe(0);
    expect(await run(["--version"], recorder().io)).toBe(0);
  });
});

describe("bundled cli", () => {
  it.runIf(existsSync("dist/cli/index.js"))("runs from the built bundle", () => {
    expect(execFileSync("node", ["dist/cli/index.js", "validate"]).toString()).toContain(
      "validate",
    );
  });
});
