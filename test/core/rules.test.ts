import { describe, expect, it } from "vitest";
import { removed, ruleDocsUrl, rules, type RuleDefinition } from "../../src/core/index.ts";
import { ruleAreas } from "../../src/core/rules.ts";
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

describe("what a rule says about itself", () => {
  it("can't leave out `why`, `area` or `since`: the type requires them", () => {
    const { why, area, since, ...rest } = rules[0]!;
    // @ts-expect-error a rule with no `why` doesn't type-check
    const noWhy: RuleDefinition = { ...rest, area, since };
    // @ts-expect-error a rule with no `area` doesn't type-check
    const noArea: RuleDefinition = { ...rest, why, since };
    // @ts-expect-error a rule with no `since` doesn't type-check
    const noSince: RuleDefinition = { ...rest, why, area };
    // @ts-expect-error an area outside the list doesn't type-check
    const badArea: RuleDefinition = { ...rest, why, since, area: "parsing" };
    expect([noWhy, noArea, noSince, badArea]).toHaveLength(4);
  });

  it.each(rules.map((r) => [r.id, r] as const))("%s says why it exists, in sentences of its own", (_id, rule) => {
    expect(rule.why).toMatch(/^[A-Z`].*\.$/);
    expect(rule.why).not.toBe(rule.summary);
  });

  it("puts every rule in exactly one area, and leaves no area empty", () => {
    const byArea = ruleAreas.map((area) => rules.filter((r) => r.area === area));
    expect(byArea.flat().map((r) => r.id).sort()).toEqual(rules.map((r) => r.id).sort());
    for (const [i, inArea] of byArea.entries()) expect(inArea.length, ruleAreas[i]).toBeGreaterThan(0);
  });

  it("names the release each rule first shipped in", () => {
    for (const rule of rules) expect(rule.since, rule.id).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("lists only current rules as related, each once and never the rule itself", () => {
    const live = new Set(rules.map((r) => r.id));
    for (const rule of rules) {
      const related = rule.related ?? [];
      expect(related.filter((id) => !live.has(id)), rule.id).toEqual([]);
      expect(related, rule.id).not.toContain(rule.id);
      expect(new Set(related).size, rule.id).toBe(related.length);
    }
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
