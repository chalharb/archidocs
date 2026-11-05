"use client";

import { createContext } from "react";

export interface EditorCallbackValue {
  readOnly: boolean;
  /** A boundary finished resizing; `box` is relative to its parent, as React Flow reports it. */
  onResized: (nodeId: string, box: { x: number; y: number; width: number; height: number }) => void;
}

export const EditorCallbacks = createContext<EditorCallbackValue>({
  readOnly: true,
  onResized: () => {},
});
