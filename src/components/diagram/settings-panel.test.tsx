import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APP_DEFAULT_LAYOUT_SETTINGS } from "@/domain/layout/settings";
import { SettingsPanel } from "./settings-panel";

function setup(overrides = {}, readOnly = false) {
  const onChange = vi.fn();
  const onRelayout = vi.fn();
  render(
    <SettingsPanel
      readOnly={readOnly}
      effective={APP_DEFAULT_LAYOUT_SETTINGS}
      overrides={overrides}
      onChange={onChange}
      onRelayout={onRelayout}
    />,
  );
  return { onChange, onRelayout };
}

describe("layout settings panel", () => {
  it("changes direction, edge style, animation and snapping", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "LEFT" } });
    expect(onChange).toHaveBeenLastCalledWith("direction", "LEFT");
    fireEvent.change(screen.getByLabelText("Edge style"), { target: { value: "bezier" } });
    expect(onChange).toHaveBeenLastCalledWith("edgeType", "bezier");
    fireEvent.click(screen.getByLabelText("Animate edges"));
    expect(onChange).toHaveBeenLastCalledWith("animateEdges", true);
    fireEvent.click(screen.getByLabelText("Snap to grid"));
    expect(onChange).toHaveBeenLastCalledWith("snapToGrid", false);
  });

  it("commits valid numbers on blur or Enter and reverts invalid ones", () => {
    const { onChange } = setup();
    const spacing = screen.getByLabelText("Node spacing") as HTMLInputElement;
    fireEvent.change(spacing, { target: { value: "120" } });
    fireEvent.keyDown(spacing, { key: "Enter" });
    fireEvent.blur(spacing);
    expect(onChange).toHaveBeenLastCalledWith("nodeSpacing", 120);
    onChange.mockClear();
    const grid = screen.getByLabelText("Grid size") as HTMLInputElement;
    fireEvent.change(grid, { target: { value: "0" } });
    fireEvent.blur(grid);
    expect(onChange).not.toHaveBeenCalled();
    expect(grid.value).toBe(String(APP_DEFAULT_LAYOUT_SETTINGS.gridSize));
    fireEvent.change(grid, { target: { value: String(APP_DEFAULT_LAYOUT_SETTINGS.gridSize) } });
    fireEvent.blur(grid);
    expect(onChange).not.toHaveBeenCalled();
    const layer = screen.getByLabelText("Layer spacing");
    fireEvent.keyDown(layer, { key: "a" });
    fireEvent.change(layer, { target: { value: "300" } });
    fireEvent.blur(layer);
    expect(onChange).toHaveBeenLastCalledWith("layerSpacing", 300);
  });

  it("offers re-layout after auto-layout settings change", () => {
    const { onRelayout } = setup({ direction: "UP" });
    fireEvent.click(screen.getByRole("button", { name: "Re-layout all" }));
    expect(onRelayout).toHaveBeenCalledOnce();
  });

  it("is read-only when the layout can't be written", () => {
    setup({ direction: "UP" }, true);
    expect(screen.getByLabelText("Direction")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Re-layout all" })).toBeNull();
  });
});
