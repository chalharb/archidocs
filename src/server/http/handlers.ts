/**
 * HTTP handlers for the workspace API (P0-09). Framework-agnostic: each takes a
 * Web Request plus dependencies and returns a Response, so they are tested
 * directly; the files under src/app/api are thin adapters.
 */
import { z } from "zod";
import {
  edgePresentationSchema,
  idSchema,
  layoutSettingsOverridesSchema,
  nodePlacementSchema,
} from "@/domain/schema/resource-schemas";
import { LayoutSaveError, type LayoutSaveErrorCode } from "../persistence/layout-writer";
import type { WorkspaceService } from "../service";
import { staleNotice, type WorkspaceRepository } from "../workspace/repository";
import { checkRequest } from "./request-guard";

export interface HttpDeps {
  service: WorkspaceService;
  allowedHosts: readonly string[];
}

export const MAX_BODY_BYTES = 1024 * 1024;

const NO_STORE = { "cache-control": "no-store" };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, status);
}

const SAVE_ERROR_STATUS: Record<LayoutSaveErrorCode, number> = {
  DIAGRAM_NOT_FOUND: 404,
  INVALID: 422,
  NOT_WRITABLE: 409,
  CONFLICT: 409,
  WRITE_FAILED: 500,
};

const revisionSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const layoutEditSchema = z.strictObject({
  settings: layoutSettingsOverridesSchema.optional(),
  nodes: z.record(idSchema, nodePlacementSchema).optional(),
  edges: z.record(idSchema, edgePresentationSchema).optional(),
});

const saveBodySchema = z.strictObject({
  baseRevision: revisionSchema.nullable(),
  layout: layoutEditSchema,
});

type Guarded = (request: Request, deps: HttpDeps) => Promise<Response>;

/** Apply request guards and turn unexpected errors into a 500 without leaking internals. */
function guarded(handler: Guarded): Guarded {
  return async (request, deps) => {
    const check = checkRequest(request, deps.allowedHosts);
    if (!check.ok) return errorResponse(check.status, "REQUEST_REJECTED", check.reason);
    try {
      return await handler(request, deps);
    } catch (err) {
      if (err instanceof LayoutSaveError) {
        return errorResponse(SAVE_ERROR_STATUS[err.code], err.code, err.message, err.details);
      }
      console.error("[archidoc] unexpected error", err);
      return errorResponse(500, "INTERNAL_ERROR", "Unexpected server error");
    }
  };
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: errorResponse(
        413,
        "BODY_TOO_LARGE",
        `Request body exceeds ${MAX_BODY_BYTES} bytes`,
      ),
    };
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: errorResponse(
        413,
        "BODY_TOO_LARGE",
        `Request body exceeds ${MAX_BODY_BYTES} bytes`,
      ),
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: errorResponse(400, "INVALID_JSON", "Request body is not valid JSON"),
    };
  }
}

async function repositoryFor(
  deps: HttpDeps,
  key: string,
): Promise<{ ok: true; repo: WorkspaceRepository } | { ok: false; response: Response }> {
  const pending = deps.service.get(key);
  if (!pending)
    return {
      ok: false,
      response: errorResponse(404, "WORKSPACE_NOT_FOUND", `Unknown workspace '${key}'`),
    };
  const entry = await pending;
  if (entry.status === "error") {
    return { ok: false, response: errorResponse(503, "WORKSPACE_UNAVAILABLE", entry.error!) };
  }
  return { ok: true, repo: entry.repository! };
}

function summary(repo: WorkspaceRepository) {
  const snap = repo.snapshot();
  const notice = staleNotice(snap);
  return {
    key: repo.key,
    status: snap.status,
    version: snap.version,
    loadedAt: snap.loadedAt,
    checkedAt: snap.checkedAt,
    diagnostics: notice ? [notice, ...snap.diagnostics] : snap.diagnostics,
  };
}

// --- Handlers ------------------------------------------------------------------

export const listWorkspaces = guarded(async (_request, deps) => {
  const entries = await deps.service.list();
  return json({
    workspaces: entries.map((e) =>
      e.status === "ready"
        ? summary(e.repository!)
        : { key: e.key, status: "unavailable", error: e.error },
    ),
  });
});

export function getWorkspace(request: Request, deps: HttpDeps, params: { workspace: string }) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const snap = r.repo.snapshot();
    return json({ ...summary(r.repo), model: snap.model, index: snap.index });
  })(request, deps);
}

export function reloadWorkspace(request: Request, deps: HttpDeps, params: { workspace: string }) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const { changed } = await r.repo.reload();
    return json({ ...summary(r.repo), changed });
  })(request, deps);
}

export function getEntity(
  request: Request,
  deps: HttpDeps,
  params: { workspace: string; entity: string },
) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const view = r.repo.entityView(params.entity);
    if (!view) return errorResponse(404, "ENTITY_NOT_FOUND", `Unknown entity '${params.entity}'`);
    return json(view);
  })(request, deps);
}

export function getDiagram(
  request: Request,
  deps: HttpDeps,
  params: { workspace: string; diagram: string },
) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const view = await r.repo.diagramView(params.diagram);
    if (!view)
      return errorResponse(404, "DIAGRAM_NOT_FOUND", `Unknown diagram '${params.diagram}'`);
    return json(view);
  })(request, deps);
}

export function saveLayout(
  request: Request,
  deps: HttpDeps,
  params: { workspace: string; diagram: string },
) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = saveBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return errorResponse(422, "INVALID", "Invalid request body", {
        issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      });
    }
    const result = await r.repo.saveLayout(
      params.diagram,
      parsed.data.layout,
      parsed.data.baseRevision as never,
    );
    return json({ path: result.path, revision: result.revision, version: result.snapshot.version });
  })(request, deps);
}

export function saveDraft(
  request: Request,
  deps: HttpDeps,
  params: { workspace: string; diagram: string },
) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = saveBodySchema.safeParse(body.value);
    if (!parsed.success) return errorResponse(422, "INVALID", "Invalid request body");
    const draft = await r.repo.saveDraft(
      params.diagram,
      parsed.data.layout,
      parsed.data.baseRevision as never,
    );
    return json({ draft });
  })(request, deps);
}

export function discardDraft(
  request: Request,
  deps: HttpDeps,
  params: { workspace: string; diagram: string },
) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    if (!idSchema.safeParse(params.diagram).success) {
      return errorResponse(404, "DIAGRAM_NOT_FOUND", `Unknown diagram '${params.diagram}'`);
    }
    await r.repo.discardDraft(params.diagram);
    return new Response(null, { status: 204, headers: NO_STORE });
  })(request, deps);
}

/** How often an idle event stream sends a keep-alive comment. */
export const EVENTS_KEEPALIVE_MS = 15_000;

/**
 * Server-sent events announcing workspace changes (RELI-01..04 in the editor).
 * Sends the current version immediately, then one event per model change.
 */
export function workspaceEvents(request: Request, deps: HttpDeps, params: { workspace: string }) {
  return guarded(async () => {
    const r = await repositoryFor(deps, params.workspace);
    if (!r.ok) return r.response;
    const repo = r.repo;
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            cleanup();
          }
        };
        const event = () => {
          const snap = repo.snapshot();
          send(
            `event: change\ndata: ${JSON.stringify({ version: snap.version, status: snap.status })}\n\n`,
          );
        };
        event();
        const unsubscribe = repo.onChange(event);
        const timer = setInterval(() => send(": keep-alive\n\n"), EVENTS_KEEPALIVE_MS);
        cleanup = () => {
          clearInterval(timer);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        request.signal.addEventListener("abort", () => cleanup(), { once: true });
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      },
    });
  })(request, deps);
}
