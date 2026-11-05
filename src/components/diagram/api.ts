"use client";

/** Browser-side calls to the workspace API. */
import type { LayoutEdit } from "@/server/persistence/layout-writer";
import type { DiagramView, EntityView } from "@/server/workspace/repository";

export interface ApiError {
  status: number;
  code: string;
  message: string;
  issues?: string[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw {
      status: res.status,
      code: err.code ?? "HTTP_ERROR",
      message: err.message ?? `Request failed (${res.status})`,
      ...(err.details?.issues ? { issues: err.details.issues } : {}),
    } satisfies ApiError;
  }
  return body as T;
}

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}`;
const diagramUrl = (ws: string, d: string) => `${base(ws)}/diagrams/${encodeURIComponent(d)}`;

export const api = {
  diagram: (ws: string, d: string) => request<DiagramView>(diagramUrl(ws, d)),
  entity: (ws: string, id: string) =>
    request<EntityView>(`${base(ws)}/entities/${encodeURIComponent(id)}`),
  saveLayout: (ws: string, d: string, baseRevision: string | null, layout: LayoutEdit) =>
    request<{ path: string; revision: string; version: number }>(`${diagramUrl(ws, d)}/layout`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseRevision, layout }),
    }),
  saveDraft: (ws: string, d: string, baseRevision: string | null, layout: LayoutEdit) =>
    request<unknown>(`${diagramUrl(ws, d)}/draft`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseRevision, layout }),
    }),
  discardDraft: (ws: string, d: string) =>
    request<void>(`${diagramUrl(ws, d)}/draft`, { method: "DELETE" }),
  eventsUrl: (ws: string) => `${base(ws)}/events`,
};

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "status" in e && "code" in e;
}
