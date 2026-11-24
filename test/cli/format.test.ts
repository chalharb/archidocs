import { describe, expect, it } from "vitest";
import { exitCodeFor, formatIssues } from "../../src/cli/format.ts";
import type { Issue } from "../../src/core/index.ts";

// No v1 warning rule exists yet (the first arrive with Saved Views), so the
// warning paths are checked on literal issue records at the CLI's output layer.
const warning: Issue = { file: "archidocs/shop/views.yaml", line: 3, rule: "empty-view", severity: "warning", message: "View resolves to no nodes" };
const error: Issue = { file: "archidocs/shop/services.yaml", line: 4, column: 5, rule: "unknown-field", severity: "error", message: "Unknown field" };

describe("check output for warnings", () => {
  it("exits 0 on warnings alone, and 1 with --strict", () => {
    expect(exitCodeFor([warning])).toBe(0);
    expect(exitCodeFor([warning], { strict: true })).toBe(1);
    expect(exitCodeFor([], { strict: true })).toBe(0);
    expect(exitCodeFor([error])).toBe(1);
  });

  it("counts warnings in every format", () => {
    expect(formatIssues([error, warning], "text")).toContain("\n1 error, 1 warning\n");
    expect(JSON.parse(formatIssues([error, warning], "json")).summary).toEqual({ errors: 1, warnings: 1 });
    expect(formatIssues([warning], "github")).toMatch(/^::warning /);
  });
});

describe("check output links each rule to its docs page", () => {
  const docs = (rule: string) => `https://archidocs.dev/docs/reference/rules/${rule}/`;
  const again: Issue = { ...error, line: 9, message: "Unknown field again" };

  it("ends text output with a Rule docs footer listing each distinct rule once", () => {
    expect(formatIssues([error, warning, again], "text")).toBe(
      [
        "archidocs/shop/services.yaml:4:5  error  unknown-field  Unknown field",
        "",
        "archidocs/shop/views.yaml:3  warning  empty-view  View resolves to no nodes",
        "",
        "archidocs/shop/services.yaml:9:5  error  unknown-field  Unknown field again",
        "",
        "2 errors, 1 warning",
        "",
        "Rule docs:",
        `  unknown-field  ${docs("unknown-field")}`,
        `  empty-view  ${docs("empty-view")}`,
        "",
      ].join("\n"),
    );
  });

  it("prints no footer when there are no issues", () => {
    expect(formatIssues([], "text")).toBe("0 errors, 0 warnings\n");
  });

  it("gives each JSON issue a docs field", () => {
    expect(JSON.parse(formatIssues([error, warning], "json")).issues).toEqual([
      { ...error, docs: docs("unknown-field") },
      { ...warning, docs: docs("empty-view") },
    ]);
  });

  it("ends each GitHub annotation message with See <url>", () => {
    expect(formatIssues([warning], "github")).toBe(
      `::warning file=archidocs/shop/views.yaml,line=3,title=empty-view::View resolves to no nodes See ${docs("empty-view")}\n`,
    );
  });
});
