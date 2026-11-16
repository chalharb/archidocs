import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configSchema } from "../../src/core/config-schema.js";
import {
  defineConfig,
  formatDiagnostic,
  loadConfig,
  validateConfig,
} from "../../src/core/config.js";

const valid = { name: "big-bank", model: "architectures/*.json" };

describe("config validation", () => {
  it("accepts a config with only the required fields", () => {
    expect(validateConfig(valid)).toEqual([]);
  });

  it("accepts every optional field together", () => {
    const full = {
      ...valid,
      title: "Big Bank plc",
      model: ["a/*.json", "b/*.json"],
      decisions: "docs/adr",
      notation: "c4",
      repository: { url: "https://github.com/acme/architecture", branch: "main" },
      site: { base: "/docs/" },
      checks: { elementInNoView: "error", maxElementsPerView: 12 },
    };
    expect(validateConfig(full)).toEqual([]);
  });

  it("names the field that is missing", () => {
    const [problem] = validateConfig({ name: "x" });
    expect(problem).toMatchObject({ path: "model", message: "is required" });
  });

  it("rejects an unknown top-level key and names it", () => {
    const [problem] = validateConfig({ ...valid, titel: "typo" });
    expect(problem).toMatchObject({ path: "titel", message: "is not a known option" });
  });

  it("rejects an unknown nested key and names its full path", () => {
    const [problem] = validateConfig({ ...valid, site: { basee: "/" } });
    expect(problem?.path).toBe("site.basee");
  });

  it("rejects a workspace name that is not a url-safe id", () => {
    const [problem] = validateConfig({ ...valid, name: "Big Bank" });
    expect(problem?.path).toBe("name");
  });

  it("explains that model takes a string or a non-empty list", () => {
    expect(validateConfig({ ...valid, model: [] })).toEqual([
      expect.objectContaining({ path: "model", message: expect.stringContaining("non-empty") }),
    ]);
    expect(validateConfig({ ...valid, model: 3 })).toHaveLength(1);
  });

  it("rejects a notation other than the built-in one", () => {
    const [problem] = validateConfig({ ...valid, notation: "uml" });
    expect(problem).toMatchObject({ path: "notation", message: "must be one of: c4" });
  });

  it("rejects a base path that does not start with a slash", () => {
    const [problem] = validateConfig({ ...valid, site: { base: "docs" } });
    expect(problem?.path).toBe("site.base");
  });

  it("rejects a repository url that is not a uri", () => {
    const [problem] = validateConfig({ ...valid, repository: { url: "not a uri" } });
    expect(problem).toMatchObject({ path: "repository.url", message: "must be a valid uri" });
  });

  it("requires a url inside repository", () => {
    const [problem] = validateConfig({ ...valid, repository: {} });
    expect(problem?.path).toBe("repository.url");
  });

  it("rejects a health check level that is not off, warn or error", () => {
    const [problem] = validateConfig({ ...valid, checks: { viewTooLarge: "loud" } });
    expect(problem?.path).toBe("checks.viewTooLarge");
  });

  it("rejects a non-integer view size limit", () => {
    const [problem] = validateConfig({ ...valid, checks: { maxElementsPerView: 1.5 } });
    expect(problem).toMatchObject({
      path: "checks.maxElementsPerView",
      message: "must be of type integer",
    });
  });

  it("rejects a config that is not an object", () => {
    const [problem] = validateConfig("nope");
    expect(problem?.message).toBe("must be of type object");
  });

  it("reports every problem, not only the first", () => {
    expect(validateConfig({ name: "Bad Name", extra: 1 }).length).toBeGreaterThanOrEqual(3);
  });
});

describe("defineConfig", () => {
  it("returns the config it was given", () => {
    expect(defineConfig(valid)).toBe(valid);
  });
});

describe("config schema", () => {
  it("marks only name and model as required", () => {
    expect(configSchema.required).toEqual(["name", "model"]);
  });

  it("rejects unknown keys at every object level", () => {
    expect(configSchema.additionalProperties).toBe(false);
    expect(configSchema.properties.repository.additionalProperties).toBe(false);
    expect(configSchema.properties.site.additionalProperties).toBe(false);
    expect(configSchema.properties.checks.additionalProperties).toBe(false);
  });
});

describe("config loading", () => {
  async function workspace(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "archidocs-config-"));
    for (const [name, content] of Object.entries(files))
      await writeFile(path.join(dir, name), content);
    return dir;
  }

  it("loads a JSON config", async () => {
    const dir = await workspace({ "archidocs.config.json": JSON.stringify(valid) });
    expect(await loadConfig(dir)).toMatchObject({ ok: true, config: valid });
  });

  it("loads a TypeScript config", async () => {
    const dir = await workspace({
      "archidocs.config.ts": `export default { name: "ts-site", model: "m/*.json" };`,
    });
    expect(await loadConfig(dir)).toMatchObject({ ok: true, config: { name: "ts-site" } });
  });

  it("names the file and the field when the config is invalid", async () => {
    const dir = await workspace({ "archidocs.config.json": JSON.stringify({ name: "x" }) });
    const result = await loadConfig(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatDiagnostic(result.diagnostics[0]!)).toBe(
        "error  archidocs.config.json: model is required",
      );
    }
  });

  it("explains how to create a config when none exists", async () => {
    const dir = await workspace({});
    const result = await loadConfig(dir);
    expect(!result.ok && result.diagnostics[0]?.message).toContain("archidocs init");
  });

  it("reports a config file that cannot be parsed", async () => {
    const dir = await workspace({ "archidocs.config.json": "{ nope" });
    const result = await loadConfig(dir);
    expect(!result.ok && result.diagnostics[0]?.message).toContain("Could not read config");
  });
});
