import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTAINERS_LAYOUT, copySampleWorkspace } from "../../../tests/helpers/workspace";
import type { TempDir } from "../../../tests/helpers/tmp";
import { WorkspaceService, getHttpDeps, getWorkspaceService } from "../service";
import {
  MAX_BODY_BYTES,
  discardDraft,
  getDiagram,
  getEntity,
  getWorkspace,
  listWorkspaces,
  reloadWorkspace,
  saveDraft,
  saveLayout,
  workspaceEvents,
  EVENTS_KEEPALIVE_MS,
  type HttpDeps,
} from "./handlers";

let ws: TempDir;
let service: WorkspaceService;
let deps: HttpDeps;

beforeEach(async () => {
  // "containers" starts unsaved so saves can use a null base revision.
  ws = await copySampleWorkspace({ without: [CONTAINERS_LAYOUT] });
  service = new WorkspaceService({
    workspaces: [
      { key: "sample", root: ws.dir },
      { key: "broken", root: path.join(ws.dir, "does-not-exist") },
    ],
    allowedHosts: [],
    watch: false,
    maxFileBytes: 1024 * 1024,
  });
  deps = { service, allowedHosts: [] };
});
afterEach(async () => {
  await service.close();
  await ws.cleanup();
});

const BASE = "http://localhost:3000";
const get = (p: string, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${p}`, { headers: { host: "localhost:3000", ...headers } });
const send = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${p}`, {
    method,
    headers: {
      host: "localhost:3000",
      origin: BASE,
      "content-type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
const S = { workspace: "sample" };

describe("read endpoints (P0-09)", () => {
  it("lists workspaces including unavailable ones", async () => {
    const res = await listWorkspaces(get("/api/workspaces"), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.workspaces).toEqual([
      expect.objectContaining({ key: "sample", status: "valid", version: 1, diagnostics: [] }),
      expect.objectContaining({
        key: "broken",
        status: "unavailable",
        error: expect.stringContaining("not found"),
      }),
    ]);
  });

  it("returns the model, index and diagnostics", async () => {
    const body = await (await getWorkspace(get("/api/workspaces/sample"), deps, S)).json();
    expect(body.status).toBe("valid");
    expect(Object.keys(body.model.entities)).toContain("payments-api");
    expect(body.index.children["payments-system"]).toEqual([
      "ledger-db",
      "payments-api",
      "web-shop",
    ]);
  });

  it("returns entity and diagram views", async () => {
    const entity = await (await getEntity(get("/x"), deps, { ...S, entity: "web-shop" })).json();
    expect(entity.diagrams).toContain("containers");
    const diagram = await (
      await getDiagram(get("/x"), deps, { ...S, diagram: "deployment" })
    ).json();
    expect(diagram.diagram.nodes.map((n: { entityId: string }) => n.entityId)).toContain(
      "payments-api",
    );
    expect(diagram.persistence.layoutFile).toBe("diagrams/deployment.layout.yaml");
  });

  it.each([
    [
      "workspace",
      () => getWorkspace(get("/x"), deps, { workspace: "nope" }),
      404,
      "WORKSPACE_NOT_FOUND",
    ],
    [
      "broken workspace",
      () => getWorkspace(get("/x"), deps, { workspace: "broken" }),
      503,
      "WORKSPACE_UNAVAILABLE",
    ],
    ["entity", () => getEntity(get("/x"), deps, { ...S, entity: "nope" }), 404, "ENTITY_NOT_FOUND"],
    [
      "diagram",
      () => getDiagram(get("/x"), deps, { ...S, diagram: "nope" }),
      404,
      "DIAGRAM_NOT_FOUND",
    ],
  ])("404s unknown %s", async (_n, call, status, code) => {
    const res = await call();
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });

  it("surfaces the stale state with an explicit notice (RELI-04)", async () => {
    await getWorkspace(get("/x"), deps, S); // open
    await rm(path.join(ws.dir, "types/entity-types.yaml"));
    await ws.write("types/entity-types.yaml", "kind: [");
    const body = await (await reloadWorkspace(send("POST", "/x"), deps, S)).json();
    expect(body).toMatchObject({ status: "stale", changed: true });
    expect(body.diagnostics[0].code).toBe("MODEL_STALE");
  });
});

describe("reload (RELI-14)", () => {
  it("reloads on POST and reports whether anything changed", async () => {
    const res = await reloadWorkspace(send("POST", "/api/workspaces/sample/reload"), deps, S);
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(false);
  });

  it("rejects cross-origin reloads", async () => {
    const res = await reloadWorkspace(
      send("POST", "/x", undefined, { origin: "https://evil.com" }),
      deps,
      S,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("REQUEST_REJECTED");
  });
});

describe("layout saves", () => {
  const P = { ...S, diagram: "containers" };

  it("saves a layout and returns the new revision", async () => {
    const res = await saveLayout(
      send("PUT", "/x", { baseRevision: null, layout: { nodes: { "web-shop": { x: 1, y: 2 } } } }),
      deps,
      P,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe("diagrams/containers.layout.yaml");
    expect(body.revision).toMatch(/^sha256:/);
    expect(await readFile(path.join(ws.dir, body.path), "utf8")).toContain("web-shop");
  });

  it("returns 409 on conflicts", async () => {
    await saveLayout(send("PUT", "/x", { baseRevision: null, layout: {} }), deps, P);
    const res = await saveLayout(send("PUT", "/x", { baseRevision: null, layout: {} }), deps, P);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: "CONFLICT",
      details: { currentRevision: expect.stringMatching(/^sha256:/) },
    });
  });

  it.each([
    ["invalid JSON", "{nope", 400, "INVALID_JSON"],
    ["wrong shape", { layout: {} }, 422, "INVALID"],
    ["bad revision", { baseRevision: "abc", layout: {} }, 422, "INVALID"],
    [
      "unknown node",
      { baseRevision: null, layout: { nodes: { ghost: { x: 0, y: 0 } } } },
      422,
      "INVALID",
    ],
    ["extra fields", { baseRevision: null, layout: {}, sneaky: true }, 422, "INVALID"],
  ])("rejects %s", async (_n, body, status, code) => {
    const res = await saveLayout(send("PUT", "/x", body), deps, P);
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });

  it("rejects unknown diagrams with 404", async () => {
    const res = await saveLayout(send("PUT", "/x", { baseRevision: null, layout: {} }), deps, {
      ...S,
      diagram: "nope",
    });
    expect(res.status).toBe(404);
  });

  it("rejects oversized bodies by declared and actual size", async () => {
    const declared = await saveLayout(
      send("PUT", "/x", "{}", { "content-length": String(MAX_BODY_BYTES + 1) }),
      deps,
      P,
    );
    expect(declared.status).toBe(413);
    const actual = await saveLayout(send("PUT", "/x", `"${"x".repeat(MAX_BODY_BYTES)}"`), deps, P);
    expect(actual.status).toBe(413);
  });

  it.each([
    ["no Origin", { origin: "" }],
    ["foreign Origin", { origin: "https://evil.com" }],
    ["form post", { "content-type": "application/x-www-form-urlencoded" }],
    ["rebinding Host", { host: "attacker.example:3000", origin: "http://attacker.example:3000" }],
  ] as Array<[string, Record<string, string>]>)(
    "refuses writes with %s and leaves files untouched",
    async (_n, headers) => {
      const h = Object.fromEntries(Object.entries(headers).filter(([, v]) => v !== ""));
      const req = send("PUT", "/x", { baseRevision: null, layout: {} }, h);
      if (headers.origin === "") req.headers.delete("origin");
      const res = await saveLayout(req, deps, P);
      expect([403, 415]).toContain(res.status);
      await expect(
        readFile(path.join(ws.dir, "diagrams/containers.layout.yaml")),
      ).rejects.toThrow();
    },
  );

  it("hides unexpected errors behind a generic 500", async () => {
    const entry = await service.get("sample")!;
    vi.spyOn(entry.repository!, "saveLayout").mockRejectedValueOnce(new Error("secret internals"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await saveLayout(send("PUT", "/x", { baseRevision: null, layout: {} }), deps, P);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret internals");
    spy.mockRestore();
  });
});

describe("drafts", () => {
  const P = { ...S, diagram: "containers" };

  it("saves and discards drafts", async () => {
    const saved = await saveDraft(
      send("PUT", "/x", { baseRevision: null, layout: { nodes: { "web-shop": { x: 3, y: 3 } } } }),
      deps,
      P,
    );
    expect(saved.status).toBe(200);
    const view = await (await getDiagram(get("/x"), deps, P)).json();
    expect(view.persistence.draft.status).toBe("recoverable");
    const del = await discardDraft(send("DELETE", "/x"), deps, P);
    expect(del.status).toBe(204);
    expect((await (await getDiagram(get("/x"), deps, P)).json()).persistence.draft).toBeNull();
  });

  it("validates draft bodies and diagram IDs", async () => {
    expect((await saveDraft(send("PUT", "/x", { nope: 1 }), deps, P)).status).toBe(422);
    expect((await saveDraft(send("PUT", "/x", "{"), deps, P)).status).toBe(400);
    expect(
      (
        await saveDraft(send("PUT", "/x", { baseRevision: null, layout: {} }), deps, {
          ...S,
          diagram: "nope",
        })
      ).status,
    ).toBe(404);
    expect(
      (await discardDraft(send("DELETE", "/x"), deps, { ...S, diagram: "../../etc" })).status,
    ).toBe(404);
    expect(
      (await discardDraft(send("DELETE", "/x"), deps, { workspace: "nope", diagram: "x" })).status,
    ).toBe(404);
  });

  it("unknown workspaces 404 on every write", async () => {
    const W = { workspace: "nope", diagram: "x" };
    expect((await saveLayout(send("PUT", "/x", {}), deps, W)).status).toBe(404);
    expect((await saveDraft(send("PUT", "/x", {}), deps, W)).status).toBe(404);
    expect((await reloadWorkspace(send("POST", "/x"), deps, { workspace: "nope" })).status).toBe(
      404,
    );
    expect((await getEntity(get("/x"), deps, { workspace: "nope", entity: "x" })).status).toBe(404);
    expect((await getDiagram(get("/x"), deps, W)).status).toBe(404);
  });
});

describe("WorkspaceService", () => {
  it("opens each workspace once and retries failed roots", async () => {
    const a = service.get("sample");
    expect(service.get("sample")).toBe(a);
    expect(service.get("unknown")).toBeNull();
    const broken1 = await service.get("broken")!;
    expect(broken1.status).toBe("error");
    expect(service.get("broken")).not.toBe(service.get("nope"));
    expect(service.keys()).toEqual(["sample", "broken"]);
  });

  it("starts watching when configured", async () => {
    const watching = new WorkspaceService(
      {
        workspaces: [{ key: "w", root: ws.dir }],
        allowedHosts: [],
        watch: true,
        maxFileBytes: 1e6,
      },
      {
        watch: { debounceMs: 20 },
      },
    );
    const entry = await watching.get("w")!;
    expect(entry.status).toBe("ready");
    await watching.close();
  });

  it("provides a process-wide singleton and HTTP deps", () => {
    const a = getWorkspaceService();
    expect(getWorkspaceService()).toBe(a);
    expect(getHttpDeps()).toEqual({ service: a, allowedHosts: a.config.allowedHosts });
  });
});

describe("workspace change events", () => {
  async function readEvent(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const { value } = await reader.read();
    return new TextDecoder().decode(value);
  }

  it("streams the current version, then one event per change, and stops on abort", async () => {
    const abort = new AbortController();
    const req = new Request(`${BASE}/api/workspaces/sample/events`, {
      headers: { host: "localhost:3000" },
      signal: abort.signal,
    });
    const res = await workspaceEvents(req, deps, S);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body!.getReader();
    const first = await readEvent(reader);
    expect(first).toMatch(/^event: change\ndata: \{"version":1,"status":"valid"\}\n\n$/);

    const file = path.join(ws.dir, "workspace.yaml");
    const text = await readFile(file, "utf8");
    await writeFile(file, text.replace("ACME Payments Architecture", "ACME Renamed"));
    await reloadWorkspace(send("POST", "/api/workspaces/sample/reload"), deps, S);
    expect(await readEvent(reader)).toContain('"version":2');

    abort.abort();
    expect((await reader.read()).done).toBe(true);
  });

  it("sends keep-alive comments and tolerates cancellation", async () => {
    vi.useFakeTimers();
    try {
      const res = await workspaceEvents(get("/api/workspaces/sample/events"), deps, S);
      const reader = res.body!.getReader();
      await readEvent(reader);
      vi.advanceTimersByTime(EVENTS_KEEPALIVE_MS);
      expect(await readEvent(reader)).toBe(": keep-alive\n\n");
      await reader.cancel();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 404 for unknown workspaces and rejects foreign hosts", async () => {
    expect(
      (await workspaceEvents(get("/api/workspaces/x/events"), deps, { workspace: "x" })).status,
    ).toBe(404);
    expect(
      (
        await workspaceEvents(
          get("/api/workspaces/sample/events", { host: "evil.example" }),
          deps,
          S,
        )
      ).status,
    ).toBe(403);
  });
});
