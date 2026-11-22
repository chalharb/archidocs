import { describe, expect, it } from "vitest";
import { rules } from "../../src/core/index.ts";
import { loadWorkspace } from "../support/workspace.ts";

// The rules ticket 01 introduces; later tickets add to the registry.
const ticketRules = [
  "yaml-syntax",
  "unknown-field",
  "missing-field",
  "invalid-value",
  "nested-project",
  "file-outside-project",
  "duplicate-project-id",
  "definition-outside-workspace",
  "unknown-team",
  "duplicate-id",
];

describe("rule registry", () => {
  it("defines each of the walking skeleton's rules once", () => {
    const ids = rules.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(ticketRules));
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(rules.map((r) => [r.id, r] as const))("%s", (id, rule) => {
    it("reports its failing example", async () => {
      const { issues } = await loadWorkspace(rule.example.failing);
      expect(issues.map((i) => i.rule)).toContain(id);
      expect(issues.filter((i) => i.rule === id).every((i) => i.severity === rule.severity)).toBe(true);
    });

    it("reports nothing once the fix is applied", async () => {
      const { issues } = await loadWorkspace(rule.example.passing);
      expect(issues).toEqual([]);
    });
  });
});
