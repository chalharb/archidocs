import { afterEach, describe, expect, it, vi } from "vitest";
import { api, isApiError } from "./api";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("workspace API client", () => {
  it("builds encoded URLs and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: 1 }));
    expect(await api.diagram("my ws", "d/1")).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/workspaces/my%20ws/diagrams/d%2F1", {
      cache: "no-store",
    });
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await api.entity("ws", "e");
    expect(fetchMock.mock.lastCall![0]).toBe("/api/workspaces/ws/entities/e");
    expect(api.eventsUrl("ws")).toBe("/api/workspaces/ws/events");
  });

  it("sends layout and draft saves as JSON", async () => {
    fetchMock.mockResolvedValue(json(200, { revision: "r" }));
    await api.saveLayout("ws", "d", null, { nodes: {} });
    const [url, init] = fetchMock.mock.lastCall!;
    expect(url).toBe("/api/workspaces/ws/diagrams/d/layout");
    expect(init).toMatchObject({ method: "PUT", headers: { "content-type": "application/json" } });
    expect(JSON.parse(init.body)).toEqual({ baseRevision: null, layout: { nodes: {} } });
    await api.saveDraft("ws", "d", "rev", {});
    expect(fetchMock.mock.lastCall![0]).toBe("/api/workspaces/ws/diagrams/d/draft");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api.discardDraft("ws", "d")).toBeUndefined();
    expect(fetchMock.mock.lastCall![1]).toMatchObject({ method: "DELETE" });
  });

  it("turns error responses into ApiErrors", async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, { error: { code: "INVALID", message: "Bad", details: { issues: ["a: b"] } } }),
    );
    const err = await api.diagram("ws", "d").catch((e) => e);
    expect(err).toEqual({ status: 422, code: "INVALID", message: "Bad", issues: ["a: b"] });
    expect(isApiError(err)).toBe(true);
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 500 }));
    expect(await api.diagram("ws", "d").catch((e) => e)).toEqual({
      status: 500,
      code: "HTTP_ERROR",
      message: "Request failed (500)",
    });
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});
