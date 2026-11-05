"use client";

/** Toolbar of the read-only view route (DIAG-12, ADD-007). */
import { AlertTriangle, CheckCircle2, Download, Maximize, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ExportFormat } from "./export";

export interface ViewBarProps {
  editHref: string;
  /** Why the layout can't be edited, if it can't. */
  notEditableReason?: string;
  problems: number;
  diagnosticsOpen: boolean;
  busy: boolean;
  onFitView: () => void;
  onExport: (format: ExportFormat) => void;
  onToggleDiagnostics: () => void;
}

export function problemsLabel(n: number): string {
  return n === 0 ? "No problems" : n === 1 ? "1 problem" : `${n} problems`;
}

export function ViewBar(p: ViewBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Diagram tools"
      className="flex flex-wrap items-center gap-1 border-b bg-background px-2 py-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Fit to view"
        title="Fit to view"
        onClick={p.onFitView}
      >
        <Maximize />
      </Button>
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={p.diagnosticsOpen}
          aria-controls="diagram-diagnostics"
          onClick={p.onToggleDiagnostics}
        >
          {p.problems === 0 ? <CheckCircle2 /> : <AlertTriangle />}
          {problemsLabel(p.problems)}
        </Button>
        {p.notEditableReason === undefined ? (
          <Link href={p.editHref} className={buttonVariants({ size: "sm" })}>
            <Pencil /> Edit layout
          </Link>
        ) : (
          <span title={p.notEditableReason}>
            <Button type="button" size="sm" disabled aria-describedby="edit-disabled-reason">
              <Pencil /> Edit layout
            </Button>
            <span id="edit-disabled-reason" className="sr-only">
              {p.notEditableReason}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
