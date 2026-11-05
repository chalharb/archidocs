import { describe, expect, it } from "vitest";
import { diagnostic } from "@/domain/diagnostics";
import { emptyModel } from "@/domain/model";
import type { WorkspaceLoad } from "./loader";
import { applyLoad } from "./snapshot";

const load = (
  name: string,
  opts: { error?: boolean; warning?: boolean; at?: string } = {},
): WorkspaceLoad => {
  const model = emptyModel();
  model.workspace = { id: name, name, layoutDefaults: {} };
  return {
    model,
    files: { "workspace.yaml": { revision: `sha256:${name}`, bytes: 1 } as never },
    diagnostics: [
      ...(opts.error ? [diagnostic("error", "YAML_SYNTAX", "bad", { file: "x.yaml" })] : []),
      ...(opts.warning ? [diagnostic("warning", "WORKSPACE_MISSING", "w")] : []),
    ],
    loadedAt: opts.at ?? `t-${name}`,
  };
};

describe("applyLoad: RELI-02/03/04 snapshot transitions", () => {
  it("first valid load becomes the active model", () => {
    const { snapshot, changed } = applyLoad(null, load("a"));
    expect(changed).toBe(true);
    expect(snapshot).toMatchObject({
      status: "valid",
      version: 1,
      loadedAt: "t-a",
      checkedAt: "t-a",
    });
    expect(snapshot.model.workspace!.id).toBe("a");
    expect(snapshot.index.outgoing).toEqual({});
  });

  it("warnings do not invalidate a load", () => {
    expect(applyLoad(null, load("a", { warning: true })).snapshot.status).toBe("valid");
  });

  it("first failing load exposes the best-effort model as invalid", () => {
    const { snapshot } = applyLoad(null, load("a", { error: true }));
    expect(snapshot.status).toBe("invalid");
    expect(snapshot.model.workspace!.id).toBe("a");
  });

  it("a failing reload keeps the last valid model and marks it stale (RELI-04)", () => {
    const valid = applyLoad(null, load("a")).snapshot;
    const { snapshot, changed } = applyLoad(valid, load("b", { error: true, at: "t-later" }));
    expect(changed).toBe(true);
    expect(snapshot.status).toBe("stale");
    expect(snapshot.model).toBe(valid.model);
    expect(snapshot.files).toBe(valid.files);
    expect(snapshot.loadedAt).toBe("t-a");
    expect(snapshot.checkedAt).toBe("t-later");
    expect(snapshot.diagnostics.map((d) => d.code)).toEqual(["YAML_SYNTAX"]);
    expect(snapshot.version).toBe(2);
  });

  it("stays stale across repeated failures, keeping the original valid model", () => {
    const valid = applyLoad(null, load("a")).snapshot;
    const stale = applyLoad(valid, load("b", { error: true })).snapshot;
    const stale2 = applyLoad(stale, load("c", { error: true })).snapshot;
    expect(stale2.status).toBe("stale");
    expect(stale2.model.workspace!.id).toBe("a");
  });

  it("recovers to valid when the files are fixed (RELI-03)", () => {
    const valid = applyLoad(null, load("a")).snapshot;
    const stale = applyLoad(valid, load("b", { error: true })).snapshot;
    const fixed = applyLoad(stale, load("c")).snapshot;
    expect(fixed).toMatchObject({ status: "valid", version: 3 });
    expect(fixed.model.workspace!.id).toBe("c");
  });

  it("an invalid workspace is replaced by later loads, valid or not", () => {
    const invalid = applyLoad(null, load("a", { error: true })).snapshot;
    const stillInvalid = applyLoad(invalid, load("b", { error: true })).snapshot;
    expect(stillInvalid).toMatchObject({ status: "invalid", version: 2 });
    expect(stillInvalid.model.workspace!.id).toBe("b");
  });

  it("reports no change for an identical reload but updates checkedAt", () => {
    const first = applyLoad(null, load("a")).snapshot;
    const { snapshot, changed } = applyLoad(first, load("a", { at: "t-again" }));
    expect(changed).toBe(false);
    expect(snapshot.version).toBe(1);
    expect(snapshot.checkedAt).toBe("t-again");
    expect(snapshot.model).toBe(first.model);
  });
});
