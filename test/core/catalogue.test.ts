import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ruleCatalogue, rules } from "../../src/core/index.ts";

describe("rule catalogue", () => {
  const catalogue = ruleCatalogue();

  it.each(rules.map((r) => [r.id, r] as const))("documents %s with its severity, meaning, failing example and fix", (id, rule) => {
    const section = catalogue.split(/^## /m).find((s) => s.startsWith(`\`${id}\`\n`));
    expect(section).toBeDefined();
    expect(section).toContain(`**Severity:** ${rule.severity}`);
    expect(section).toContain(rule.summary);
    expect(section).toContain(`**Fix:** ${rule.fix}`);
    expect(section).toContain("**Failing example**");
    expect(section).toContain("**Fixed**");
  });

  it("shows only the files the fix changes, before and after", () => {
    const section = catalogue.split(/^## /m).find((s) => s.startsWith("`unknown-team`\n"))!;
    expect(section).toContain("`shop/services.yaml`:\n\n```yaml\nservices:\n  web:\n    name: Web\n    owner: cor\n```");
    expect(section).toContain("```yaml\nservices:\n  web:\n    name: Web\n    owner: core\n```");
    expect(section).not.toContain("teams:");
  });

  it("is published in docs/rules.md, regenerated with `pnpm rules:catalogue`", async () => {
    const published = await readFile(new URL("../../docs/rules.md", import.meta.url), "utf8");
    expect(published).toBe(catalogue);
  });
});
