"use client";

/**
 * Layout settings for this diagram, saved to its layout file
 * (LAYOUT-03/05/06/07, LAYOUT-25, LAYOUT-26).
 */
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  EDGE_TYPES,
  LAYOUT_DIRECTIONS,
  type LayoutSettings,
  type LayoutSettingsOverrides,
} from "@/domain/resources";

export const EDGE_TYPE_LABEL: Record<(typeof EDGE_TYPES)[number], string> = {
  straight: "Straight",
  bezier: "Bezier",
  step: "Step",
  smoothstep: "Smooth step",
};

const DIRECTION_LABEL: Record<(typeof LAYOUT_DIRECTIONS)[number], string> = {
  DOWN: "Top to bottom",
  UP: "Bottom to top",
  RIGHT: "Left to right",
  LEFT: "Right to left",
};

export interface SettingsPanelProps {
  readOnly: boolean;
  effective: LayoutSettings;
  overrides: LayoutSettingsOverrides;
  onChange: <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K] | undefined) => void;
  onRelayout: () => void;
}

const field = "flex items-center justify-between gap-2 text-sm";
const control =
  "h-7 rounded-md border bg-background px-2 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring";

function NumberSetting({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onCommit: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className={field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        // Remount when the value changes from outside (undo, reload).
        key={value}
        type="number"
        className={`${control} w-20`}
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onBlur={(e) => {
          const v = Number(e.currentTarget.value);
          if (Number.isFinite(v) && v >= min && v <= max && v !== value) onCommit(v);
          else e.currentTarget.value = String(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

export function SettingsPanel({
  readOnly,
  effective,
  overrides,
  onChange,
  onRelayout,
}: SettingsPanelProps) {
  const ids = {
    direction: useId(),
    edge: useId(),
    snap: useId(),
    animate: useId(),
    minimap: useId(),
  };
  const autoLayoutChanged =
    overrides.direction !== undefined ||
    overrides.nodeSpacing !== undefined ||
    overrides.layerSpacing !== undefined;
  return (
    <section aria-labelledby="layout-settings-heading" className="flex flex-col gap-2">
      <h2 id="layout-settings-heading" className="font-medium">
        Layout
      </h2>
      <div className={field}>
        <label htmlFor={ids.direction}>Direction</label>
        <select
          id={ids.direction}
          className={control}
          value={effective.direction}
          disabled={readOnly}
          onChange={(e) =>
            onChange("direction", e.currentTarget.value as LayoutSettings["direction"])
          }
        >
          {LAYOUT_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {DIRECTION_LABEL[d]}
            </option>
          ))}
        </select>
      </div>
      <NumberSetting
        label="Node spacing"
        value={effective.nodeSpacing}
        min={0}
        max={1000}
        disabled={readOnly}
        onCommit={(v) => onChange("nodeSpacing", v)}
      />
      <NumberSetting
        label="Layer spacing"
        value={effective.layerSpacing}
        min={0}
        max={1000}
        disabled={readOnly}
        onCommit={(v) => onChange("layerSpacing", v)}
      />
      {autoLayoutChanged && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Direction and spacing apply to automatic layout.{" "}
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={onRelayout}
          >
            Re-layout all
          </Button>{" "}
          to apply them to every node.
        </p>
      )}
      <div className={field}>
        <label htmlFor={ids.edge}>Edge style</label>
        <select
          id={ids.edge}
          className={control}
          value={effective.edgeType}
          disabled={readOnly}
          onChange={(e) =>
            onChange("edgeType", e.currentTarget.value as LayoutSettings["edgeType"])
          }
        >
          {EDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EDGE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className={field}>
        <label htmlFor={ids.animate}>Animate edges</label>
        <input
          id={ids.animate}
          type="checkbox"
          checked={effective.animateEdges}
          disabled={readOnly}
          onChange={(e) => onChange("animateEdges", e.currentTarget.checked)}
        />
      </div>
      <div className={field}>
        <label htmlFor={ids.snap}>Snap to grid</label>
        <input
          id={ids.snap}
          type="checkbox"
          checked={effective.snapToGrid}
          disabled={readOnly}
          onChange={(e) => onChange("snapToGrid", e.currentTarget.checked)}
        />
      </div>
      <NumberSetting
        label="Grid size"
        value={effective.gridSize}
        min={1}
        max={200}
        disabled={readOnly}
        onCommit={(v) => onChange("gridSize", v)}
      />
      <div className={field}>
        <label htmlFor={ids.minimap}>Show minimap</label>
        <input
          id={ids.minimap}
          type="checkbox"
          checked={effective.showMinimap}
          disabled={readOnly}
          onChange={(e) => onChange("showMinimap", e.currentTarget.checked)}
        />
      </div>
    </section>
  );
}
