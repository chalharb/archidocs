"use client";

import { createContext } from "react";

export interface EditorCallbackValue {
  readOnly: boolean;
  /** True while exporting: edges render without flow animation (LAYOUT-25). */
  staticEdges: boolean;
  /** A boundary finished resizing; `box` is relative to its parent, as React Flow reports it. */
  onResized: (nodeId: string, box: { x: number; y: number; width: number; height: number }) => void;
}

export const EditorCallbacks = createContext<EditorCallbackValue>({
  readOnly: true,
  staticEdges: false,
  onResized: () => {},
});
