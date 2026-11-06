import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTAINERS_LAYOUT, copySampleWorkspace } from "../../../tests/helpers/workspace";
import { tempDir, type TempDir } from "../../../tests/helpers/tmp";
import { toFsError } from "../fs/errors";
import { MAX_IMAGE_BYTES } from "../fs/images";
import { WorkspaceService, getHttpDeps, getWorkspaceService } from "../service";
import {
  MAX_BODY_BYTES,
  discardDraft,
  getDiagram,
  getEntity,
  getWorkspace,
  getWorkspaceFile,
  SVG_CSP,
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
    readOnly: false,
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
        readOnly: false,
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

  it("answers 204 in hosted read-only mode without watching, so clients stop reconnecting", async () => {
    const hosted = new WorkspaceService({
      workspaces: [{ key: "sample", root: ws.dir }],
      allowedHosts: [],
      watch: false,
      maxFileBytes: 1e6,
      readOnly: true,
    });
    try {
      const res = await workspaceEvents(
        get("/api/workspaces/sample/events"),
        { service: hosted, allowedHosts: [] },
        S,
      );
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    } finally {
      await hosted.close();
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

describe("workspace images (SEC-12)", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const file = (p: string, workspace = "sample", d: HttpDeps = deps) =>
    getWorkspaceFile(get(`/api/workspaces/${workspace}/files/${p}`), d, {
      workspace,
      path: p.split("/"),
    });
  const put = async (rel: string, content: string | Buffer) => {
    await mkdir(path.dirname(path.join(ws.dir, rel)), { recursive: true });
    await writeFile(path.join(ws.dir, rel), content);
  };

  it.each([
    ["img/a.png", "image/png"],
    ["img/a.jpg", "image/jpeg"],
    ["img/a.jpeg", "image/jpeg"],
    ["img/a.gif", "image/gif"],
    ["img/a.webp", "image/webp"],
  ])("serves %s as %s with nosniff and no CSP", async (p, type) => {
    await put(p, PNG);
    const res = await file(p);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(type);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe(String(PNG.byteLength));
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("serves SVG as an image with a restrictive CSP", async () => {
    await put("img/diagram.svg", SVG);
    const res = await file("img/diagram.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toBe(SVG_CSP);
    for (const directive of ["default-src 'none'", "style-src 'unsafe-inline'", "sandbox"]) {
      expect(csp).toContain(directive);
    }
    expect(await res.text()).toBe(SVG);
  });

  const refused = async (res: Response, status: number, code: string) => {
    expect(res.status).toBe(status);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect((await res.json()).error.code).toBe(code);
  };

  it("refuses disallowed types with 415", async () => {
    await refused(await file("workspace.yaml"), 415, "UNSUPPORTED_TYPE");
    await refused(await file("img/page.html"), 415, "UNSUPPORTED_TYPE");
  });

  it("refuses images over 5 MiB with 413", async () => {
    await put("img/huge.png", Buffer.alloc(MAX_IMAGE_BYTES + 1));
    await refused(await file("img/huge.png"), 413, "TOO_LARGE");
  });

  it.each([
    ["..", "secret.png"],
    ["img", "..", "..", "secret.png"],
    ["%2e%2e", "secret.png"].map(decodeURIComponent),
    ["..%2Fsecret.png"].map(decodeURIComponent),
    ["", "etc", "passwd.png"],
  ])("refuses traversal and absolute path %j with 403", async (...segments) => {
    const res = await getWorkspaceFile(get("/api/workspaces/sample/files/x"), deps, {
      workspace: "sample",
      path: segments,
    });
    await refused(res, 403, "OUTSIDE_ROOT");
  });

  it("refuses symlinks pointing outside the workspace with 403", async () => {
    const outside = await tempDir({ "secret.png": "secret" });
    try {
      await symlink(path.join(outside.dir, "secret.png"), path.join(ws.dir, "leak.png"));
      await refused(await file("leak.png"), 403, "SYMLINK_REJECTED");
    } finally {
      await outside.cleanup();
    }
  });

  it("refuses hidden directories such as .git with 400", async () => {
    await put(".git/logo.png", PNG);
    await refused(await file(".git/logo.png"), 400, "INVALID_PATH");
  });

  it("returns 404 for a missing file or unknown workspace", async () => {
    await refused(await file("img/missing.png"), 404, "NOT_FOUND");
    await refused(await file("img/a.png", "nope"), 404, "WORKSPACE_NOT_FOUND");
  });

  it("applies the request guard", async () => {
    await put("img/a.png", PNG);
    const res = await getWorkspaceFile(
      get("/api/workspaces/sample/files/img/a.png", { host: "evil.example" }),
      deps,
      { workspace: "sample", path: ["img", "a.png"] },
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("hides I/O error details", async () => {
    await put("img/a.png", PNG);
    const repo = (await service.get("sample"))!.repository!;
    const spy = vi
      .spyOn(repo.root, "readBytes")
      .mockRejectedValue(
        toFsError(Object.assign(new Error("disk on fire"), { code: "EIO" }), "img/a.png"),
      );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await file("img/a.png");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe("IO_ERROR");
      expect(body.error.message).not.toContain("disk on fire");
    } finally {
      spy.mockRestore();
      errors.mockRestore();
    }
  });

  it("serves images the same way in hosted read-only mode (SEC-13)", async () => {
    await put("img/a.png", PNG);
    const hosted = new WorkspaceService({ ...service.config, readOnly: true });
    try {
      const res = await file("img/a.png", "sample", { service: hosted, allowedHosts: [] });
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    } finally {
      await hosted.close();
    }
  });
});
