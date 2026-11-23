import { useReactFlow, useStore } from "@xyflow/react";
import { useEffect } from "react";

/** How much one mouse-wheel notch zooms with Ctrl held, matching a ⌘ + wheel notch. */
const NOTCH_FACTOR = 1.15;
/** A trackpad pinch arrives as Ctrl + wheel with small deltas; a mouse notch is far bigger. */
const NOTCH_MIN_DELTA = 50;

/**
 * Ctrl + mouse wheel zooms one even step per notch, about the pointer, as Figma does.
 * React Flow treats every Ctrl + wheel as a trackpad pinch and, on macOS, multiplies it tenfold,
 * so a single notch would jump straight to the zoom limit. Pinches keep React Flow's own handling.
 */
export function CtrlWheelZoom() {
  const dom = useStore((s) => s.domNode);
  const minZoom = useStore((s) => s.minZoom);
  const maxZoom = useStore((s) => s.maxZoom);
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    if (!dom) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(e.deltaY) < NOTCH_MIN_DELTA) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = dom.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { x, y, zoom } = getViewport();
      const next = Math.min(maxZoom, Math.max(minZoom, zoom * NOTCH_FACTOR ** -Math.sign(e.deltaY)));
      // Keep the point under the pointer where it is.
      void setViewport({ x: px - ((px - x) * next) / zoom, y: py - ((py - y) * next) / zoom, zoom: next });
    };
    dom.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => dom.removeEventListener("wheel", onWheel, { capture: true });
  }, [dom, minZoom, maxZoom, getViewport, setViewport]);
  return null;
}
