/**
 * Layout settings precedence (PRD §4, PREC-01/02):
 * application defaults → workspace defaults → diagram defaults → layout-file overrides.
 * Generated positions (level 4) affect positioning only and never settings (PREC-03).
 */
import type { LayoutSettings, LayoutSettingsOverrides } from "../resources";

export const APP_DEFAULT_LAYOUT_SETTINGS: Readonly<LayoutSettings> = Object.freeze({
  direction: "DOWN",
  nodeSpacing: 80,
  layerSpacing: 100,
  edgeType: "smoothstep",
  gridSize: 20,
  snapToGrid: true,
  nodeWidth: 200,
  nodeHeight: 100,
});

/** Canonical key order, used for deterministic output. */
export const LAYOUT_SETTING_KEYS = Object.keys(APP_DEFAULT_LAYOUT_SETTINGS) as Array<
  keyof LayoutSettings
>;

export type SettingSource = "app" | "workspace" | "diagram" | "layout";

export interface SettingsLevels {
  workspace?: LayoutSettingsOverrides;
  diagram?: LayoutSettingsOverrides;
  layout?: LayoutSettingsOverrides;
}

export interface ResolvedSettings {
  settings: LayoutSettings;
  /** Which level supplied each effective value. */
  sources: Record<keyof LayoutSettings, SettingSource>;
}

export function resolveLayoutSettings(levels: SettingsLevels): ResolvedSettings {
  const settings = { ...APP_DEFAULT_LAYOUT_SETTINGS } as Record<keyof LayoutSettings, unknown>;
  const sources = {} as Record<keyof LayoutSettings, SettingSource>;
  const order: Array<[SettingSource, LayoutSettingsOverrides | undefined]> = [
    ["workspace", levels.workspace],
    ["diagram", levels.diagram],
    ["layout", levels.layout],
  ];
  for (const key of LAYOUT_SETTING_KEYS) {
    sources[key] = "app";
    for (const [level, overrides] of order) {
      const value = overrides?.[key];
      if (value !== undefined) {
        settings[key] = value;
        sources[key] = level;
      }
    }
  }
  return { settings: settings as unknown as LayoutSettings, sources };
}
