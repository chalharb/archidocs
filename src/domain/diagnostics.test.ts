import { describe, expect, it } from "vitest";
import {
  compareDiagnostics,
  countBySeverity,
  diagnostic,
  formatPath,
  hasErrors,
  sortDiagnostics,
} from "./diagnostics";

describe("diagnostics", () => {
  it("omits undefined optional fields", () => {
    const d = diagnostic("error", "REF_MISSING", "m", { file: "a.yaml", hint: undefined });
    expect(d).toEqual({ severity: "error", code: "REF_MISSING", message: "m", file: "a.yaml" });
    expect("hint" in d).toBe(false);
  });

  it("formats paths", () => {
    expect(formatPath(undefined)).toBe("");
    expect(formatPath([])).toBe("");
    expect(formatPath(["entities", 2, "name"])).toBe("entities[2].name");
    expect(formatPath([0, "id"])).toBe("[0].id");
  });

  it("detects errors and counts severities", () => {
    const list = [
      diagnostic("warning", "WORKSPACE_MISSING", "w"),
      diagnostic("info", "WORKSPACE_MISSING", "i"),
    ];
    expect(hasErrors(list)).toBe(false);
    expect(hasErrors([...list, diagnostic("error", "YAML_SYNTAX", "e")])).toBe(true);
    expect(countBySeverity([...list, diagnostic("error", "YAML_SYNTAX", "e")])).toEqual({
      error: 1,
      warning: 1,
      info: 1,
    });
  });

  it("sorts deterministically by file, document, path, severity, code, message", () => {
    const a = diagnostic("warning", "REF_MISSING", "b", {
      file: "a.yaml",
      document: 0,
      path: ["x"],
    });
    const b = diagnostic("error", "REF_MISSING", "b", { file: "a.yaml", document: 0, path: ["x"] });
    const c = diagnostic("error", "ID_DUPLICATE", "b", {
      file: "a.yaml",
      document: 0,
      path: ["x"],
    });
    const d = diagnostic("error", "ID_DUPLICATE", "a", {
      file: "a.yaml",
      document: 0,
      path: ["x"],
    });
    const e = diagnostic("error", "ID_DUPLICATE", "a", { file: "a.yaml", document: 1 });
    const f = diagnostic("error", "ID_DUPLICATE", "a", { file: "b.yaml" });
    const g = diagnostic("error", "ID_DUPLICATE", "a");
    const h = diagnostic("error", "ID_DUPLICATE", "a", { file: "a.yaml" });
    const sorted = sortDiagnostics([f, e, a, b, c, d, g, h]);
    expect(sorted).toEqual([g, h, d, c, b, a, e, f]);
    expect(compareDiagnostics(a, a)).toBe(0);
  });
});
