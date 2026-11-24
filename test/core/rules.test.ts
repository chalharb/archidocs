import { describe, expect, it } from "vitest";
import { removed, ruleDocsUrl, rules } from "../../src/core/index.ts";
import { loadWorkspace } from "../support/workspace.ts";

// The rules tickets 01, 03, 04 and 05 introduce; later tickets add to the registry.
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
  "invalid-nesting",
  "external-with-components",
  "unknown-element",
  "unknown-project",
  "own-project-prefix",
  "wrong-kind",
  "duplicate-relationship-id",
  "self-relationship",
  "person-as-provider",
  "ancestor-descendant-relationship",
  "via-on-sync",
  "via-not-broker",
  "unknown-environment",
  "unknown-target",
  "duplicate-deployment",
];

describe("rule registry", () => {
  it("defines each rule once", () => {
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

describe("removed rules", () => {
  it("never shares an id with the registry", () => {
    const live = new Set(rules.map((r) => r.id));
    expect(removed.map((r) => r.id).filter((id) => live.has(id))).toEqual([]);
  });

  it("lists each removed id once", () => {
    const ids = removed.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("rule docs links", () => {
  it("points at the rule's page on the docs site", () => {
    expect(ruleDocsUrl("unknown-team")).toBe("https://archidocs.dev/docs/reference/rules/unknown-team/");
  });
});
