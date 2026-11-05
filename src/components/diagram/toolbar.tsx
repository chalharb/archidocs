"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Download,
  LayoutGrid,
  Maximize,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { AlignMode, DistributeAxis } from "@/editor/geometry";
import type { ExportFormat } from "./export";

export interface ToolbarProps {
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedCount: number;
  dirty: boolean;
  saving: boolean;
  busy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onRelayout: () => void;
  onFitView: () => void;
  onExport: (format: ExportFormat) => void;
  onSave: () => void;
  onRevert: () => void;
  /** Leave the editor for the view route (ADD-007). */
  onDone: () => void;
}

function Tool({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

const ALIGN: Array<[AlignMode, string, ReactNode]> = [
  ["left", "Align left", <AlignStartVertical key="l" />],
  ["center", "Align centre", <AlignCenterVertical key="c" />],
  ["right", "Align right", <AlignEndVertical key="r" />],
  ["top", "Align top", <AlignStartHorizontal key="t" />],
  ["middle", "Align middle", <AlignCenterHorizontal key="m" />],
  ["bottom", "Align bottom", <AlignEndHorizontal key="b" />],
];

export function Toolbar(p: ToolbarProps) {
  const edit = !p.readOnly;
  return (
    <div
      role="toolbar"
      aria-label="Layout tools"
      className="flex flex-wrap items-center gap-1 border-b bg-background px-2 py-1"
    >
      <Tool label="Undo" onClick={p.onUndo} disabled={!p.canUndo}>
        <Undo2 />
      </Tool>
      <Tool label="Redo" onClick={p.onRedo} disabled={!p.canRedo}>
        <Redo2 />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      {ALIGN.map(([mode, label, icon]) => (
        <Tool
          key={mode}
          label={label}
          onClick={() => p.onAlign(mode)}
          disabled={!edit || p.selectedCount < 2}
        >
          {icon}
        </Tool>
      ))}
      <Tool
        label="Distribute horizontally"
        onClick={() => p.onDistribute("horizontal")}
        disabled={!edit || p.selectedCount < 3}
      >
        <AlignHorizontalSpaceAround />
      </Tool>
      <Tool
        label="Distribute vertically"
        onClick={() => p.onDistribute("vertical")}
        disabled={!edit || p.selectedCount < 3}
      >
        <AlignVerticalSpaceAround />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={p.onRelayout}
        disabled={!edit || p.busy}
      >
        <LayoutGrid /> Re-layout all
      </Button>
      <Tool label="Fit to view" onClick={p.onFitView}>
        <Maximize />
      </Tool>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => p.onExport("png")}
        disabled={p.busy}
      >
        <Download /> PNG
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => p.onExport("svg")}
        disabled={p.busy}
      >
        <Download /> SVG
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {p.saving ? "Saving…" : p.dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={p.onRevert}
          disabled={!p.dirty || p.saving}
        >
          Revert
        </Button>
        <Button type="button" size="sm" onClick={p.onSave} disabled={!edit || !p.dirty || p.saving}>
          <Save /> Save layout
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={p.onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
