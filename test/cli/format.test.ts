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
    expect(formatIssues([error, warning], "text")).toBe(
      "archidocs/shop/services.yaml:4:5  error  unknown-field  Unknown field\n\narchidocs/shop/views.yaml:3  warning  empty-view  View resolves to no nodes\n\n1 error, 1 warning\n",
    );
    expect(JSON.parse(formatIssues([error, warning], "json")).summary).toEqual({ errors: 1, warnings: 1 });
    expect(formatIssues([warning], "github")).toBe("::warning file=archidocs/shop/views.yaml,line=3,title=empty-view::View resolves to no nodes\n");
  });
});
