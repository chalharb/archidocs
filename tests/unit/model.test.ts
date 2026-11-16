import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadModel, loadModelFile } from "../../src/core/model.js";

const fixtures = path.resolve("tests/fixtures/models");

describe("model loading", () => {
  it("lists the views declared in a valid file", async () => {
    const file = await loadModelFile(path.join(fixtures, "valid-minimal"), "architecture.json");
    expect(file.errors).toEqual([]);
    expect(file.views).toEqual([
      { id: "context", title: "System context", group: "Overview" },
      { id: "containers", title: "Containers" },
    ]);
  });

  it("reports malformed JSON against its file without throwing", async () => {
    const file = await loadModelFile(path.join(fixtures, "invalid-json"), "broken.json");
    expect(file.views).toEqual([]);
    expect(file.errors[0]).toMatchObject({ file: "broken.json" });
    expect(file.errors[0]?.message).toContain("Not valid JSON");
  });

  it("names the field when the nodes are the wrong shape", async () => {
    const file = await loadModelFile(path.join(fixtures, "invalid-shape"), "wrong-shape.json");
    expect(file.errors[0]).toMatchObject({ file: "wrong-shape.json", path: "nodes" });
  });

  it("finds files by glob in a stable order", async () => {
    const files = await loadModel(fixtures, "*/*.json");
    expect(files.map((f) => f.file)).toEqual([
      "invalid-json/broken.json",
      "invalid-shape/wrong-shape.json",
      "valid-minimal/architecture.json",
    ]);
  });

  it("keeps good files loadable next to bad ones", async () => {
    const files = await loadModel(fixtures, ["*/*.json"]);
    expect(files.filter((f) => f.errors.length === 0)).toHaveLength(1);
  });

  describe("view metadata", () => {
    async function load(document: unknown) {
      const dir = await mkdtemp(path.join(tmpdir(), "archidocs-model-"));
      await writeFile(path.join(dir, "m.json"), JSON.stringify(document));
      return loadModelFile(dir, "m.json");
    }

    it("reads views from a metadata list", async () => {
      const file = await load({ nodes: [], metadata: [{ other: 1 }, { views: [{ id: "a" }] }] });
      expect(file.views).toEqual([{ id: "a", title: "a" }]);
    });

    it("skips view entries that have no id", async () => {
      const file = await load({ nodes: [], metadata: { views: [{ title: "x" }, "nope"] } });
      expect(file.views).toEqual([]);
    });

    it("accepts a file with no metadata and no relationships", async () => {
      expect((await load({ nodes: [] })).errors).toEqual([]);
    });

    it("rejects relationships that are not a list", async () => {
      expect((await load({ nodes: [], relationships: {} })).errors[0]?.path).toBe("relationships");
    });

    it("rejects a document that is not an object", async () => {
      expect((await load([])).errors[0]?.message).toContain("JSON object");
    });
  });
});
