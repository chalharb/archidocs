import { useEffect, useState } from "react";
import type { ResolvedView } from "../../src/core/views/index.ts";
import type { Direction, Layout } from "../../src/render/layout.ts";

export interface LayoutRequest {
  request: number;
  view: ResolvedView;
  direction: Direction;
}

export type LayoutReply = { request: number; layout: Layout } | { request: number; error: string };

let worker: Worker | undefined;
let next = 0;
const pending = new Map<number, (reply: LayoutReply) => void>();

/** Lays out a View in the shared layout worker, with the same `layoutView` that `archidocs export` runs. */
export function layoutInWorker(view: ResolvedView, direction: Direction): Promise<LayoutReply> {
  if (!worker) {
    worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<LayoutReply>) => {
      pending.get(event.data.request)?.(event.data);
      pending.delete(event.data.request);
    };
  }
  const request = ++next;
  return new Promise((resolve) => {
    pending.set(request, resolve);
    worker!.postMessage({ request, view, direction } satisfies LayoutRequest);
  });
}

export interface LaidOut {
  view: ResolvedView;
  layout: Layout;
}

/** The latest View's Layout; an older request finishing late never replaces a newer one. */
export function useLayout(view: ResolvedView | undefined, direction: Direction): { laidOut: LaidOut | undefined; error: string | undefined } {
  const [state, setState] = useState<{ laidOut?: LaidOut; error?: string }>({});
  useEffect(() => {
    if (!view) return;
    let current = true;
    void layoutInWorker(view, direction).then((reply) => {
      if (!current) return;
      setState("layout" in reply ? { laidOut: { view, layout: reply.layout } } : { error: reply.error });
    });
    return () => {
      current = false;
    };
  }, [view, direction]);
  return { laidOut: state.laidOut, error: state.error };
}
