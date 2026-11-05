import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar, type ToolbarProps } from "./toolbar";

function setup(overrides: Partial<ToolbarProps> = {}) {
  const props: ToolbarProps = {
    readOnly: false,
    canUndo: true,
    canRedo: true,
    selectedCount: 3,
    dirty: true,
    saving: false,
    busy: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onAlign: vi.fn(),
    onDistribute: vi.fn(),
    onRelayout: vi.fn(),
    onFitView: vi.fn(),
    onExport: vi.fn(),
    onSave: vi.fn(),
    onRevert: vi.fn(),
    ...overrides,
  };
  render(<Toolbar {...props} />);
  return props;
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("layout toolbar", () => {
  it("invokes every action", () => {
    const p = setup();
    click("Undo");
    click("Redo");
    for (const [label, mode] of [
      ["Align left", "left"],
      ["Align centre", "center"],
      ["Align right", "right"],
      ["Align top", "top"],
      ["Align middle", "middle"],
      ["Align bottom", "bottom"],
    ] as const) {
      click(label);
      expect(p.onAlign).toHaveBeenLastCalledWith(mode);
    }
    click("Distribute horizontally");
    expect(p.onDistribute).toHaveBeenLastCalledWith("horizontal");
    click("Distribute vertically");
    expect(p.onDistribute).toHaveBeenLastCalledWith("vertical");
    click("Re-layout all");
    click("Fit to view");
    click("PNG");
    expect(p.onExport).toHaveBeenLastCalledWith("png");
    click("SVG");
    expect(p.onExport).toHaveBeenLastCalledWith("svg");
    click("Revert");
    click("Save layout");
    for (const fn of [p.onUndo, p.onRedo, p.onRelayout, p.onFitView, p.onRevert, p.onSave])
      expect(fn).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("disables what can't be done", () => {
    setup({ canUndo: false, canRedo: false, selectedCount: 2, dirty: false });
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Align left" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Distribute vertically" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save layout" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved");
  });

  it("is read-only and shows saving progress", () => {
    setup({ readOnly: true, saving: true });
    expect(screen.getByRole("button", { name: "Align left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Re-layout all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save layout" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PNG" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });
});
