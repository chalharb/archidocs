/// <reference lib="webworker" />
import ElkBundled from "elkjs/lib/elk.bundled.js";
import type { ELK } from "elkjs/lib/elk-api.js";
import { layoutView, type Layout } from "../../src/render/layout.ts";
import type { LayoutRequest, LayoutReply } from "./layout.ts";

declare const self: DedicatedWorkerGlobalScope;

// elkjs's bundle, when its engine starts inside a worker, takes `self.onmessage` for itself. So the engine
// starts first, here, running in this worker's thread, and the handler below is assigned after it.
const elk = new (ElkBundled as unknown as new () => ELK)();

self.onmessage = async (event: MessageEvent<LayoutRequest>) => {
  const { request, view, direction } = event.data;
  try {
    const layout: Layout = await layoutView(view, { direction, elk });
    self.postMessage({ request, layout } satisfies LayoutReply);
  } catch (error) {
    self.postMessage({ request, error: error instanceof Error ? error.message : String(error) } satisfies LayoutReply);
  }
};
