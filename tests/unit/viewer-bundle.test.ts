import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assets = path.resolve("dist/viewer/assets");

describe("viewer bundle", () => {
  it.runIf(existsSync(assets))("does not contain the layout engine", () => {
    const scripts = readdirSync(assets).filter((f) => f.endsWith(".js"));
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const source = readFileSync(path.join(assets, script), "utf8");
      expect(source, script).not.toMatch(/elkjs|ElkWorker|elk-api|org\.eclipse\.elk/i);
    }
  });

  it("is checked against a real build in CI", () => {
    // Guards against the check above silently skipping where a build is expected.
    if (process.env["CI"]) expect(existsSync(assets)).toBe(true);
  });
});
