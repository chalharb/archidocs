import { describe, expect, it } from "vitest";
import { migrateBundle, type Migration } from "../../src/history/index.ts";
import { loadWorkspace } from "../support/workspace.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";

describe("Bundle migrations", () => {
  it("reads a current Bundle as is", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    expect(migrateBundle(JSON.parse(JSON.stringify(bundle)))).toEqual(bundle);
  });

  it("upgrades an older Bundle through each migration in turn", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    // A made-up version 0 that had no ADRs and called Deployment Targets `infrastructure`.
    const old: Record<string, unknown> = { ...bundle, schemaVersion: 0, infrastructure: bundle.targets };
    delete old.adrs;
    delete old.targets;
    const chain: Record<number, Migration> = { 0: ({ infrastructure, ...b }) => ({ ...b, targets: infrastructure, adrs: [] }) };

    expect(migrateBundle(old, chain)).toEqual({ ...bundle, adrs: [] });
  });

  it("gives up on a Bundle it has no migration for, or one from a newer Archidocs", async () => {
    const { bundle } = await loadWorkspace(landscapeWorkspace);
    expect(migrateBundle({ ...bundle, schemaVersion: 0 })).toBeUndefined();
    expect(migrateBundle({ ...bundle, schemaVersion: 2 })).toBeUndefined();
    expect(migrateBundle("not a bundle")).toBeUndefined();
  });
});
