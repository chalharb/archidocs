import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng, toSvg } from "html-to-image";
import {
  EXPORT_MARGIN,
  PNG_PIXEL_RATIO,
  downloadDataUrl,
  inlineSvgStyles,
  renderDiagramImage,
} from "./export";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,AA"),
  toSvg: vi.fn(async () => "data:image/svg+xml,<svg/>"),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

function canvas() {
  const container = document.createElement("div");
  container.innerHTML = `<div class="react-flow__viewport"><svg><path class="a" style="fill: red"></path><path class="b"></path></svg></div>`;
  document.body.appendChild(container);
  return container;
}

const nodes = [
  { id: "a", position: { x: 10, y: 20 }, width: 100, height: 50, data: {} },
  { id: "b", position: { x: 210, y: 120 }, width: 100, height: 50, data: {} },
];

describe("PNG/SVG export (LAYOUT-15)", () => {
  it("inlines SVG paint styles and restores them afterwards", () => {
    const c = canvas();
    const [a, b] = c.querySelectorAll("path");
    const restore = inlineSvgStyles(c);
    expect(a!.getAttribute("style")).toContain("stroke-dasharray");
    expect(b!.getAttribute("style")).toContain("display");
    restore();
    expect(a!.getAttribute("style")).toBe("fill: red");
    expect(b!.hasAttribute("style")).toBe(false);
  });

  it("renders the whole diagram with a margin, statically", async () => {
    const c = canvas();
    vi.mocked(toPng).mockImplementationOnce(async () => {
      expect(c.classList.contains("arch-static")).toBe(true);
      return "data:image/png;base64,AA";
    });
    expect(await renderDiagramImage(c, nodes, "png")).toBe("data:image/png;base64,AA");
    const opts = vi.mocked(toPng).mock.lastCall![1]!;
    expect(opts).toMatchObject({
      width: 300 + EXPORT_MARGIN * 2,
      height: 150 + EXPORT_MARGIN * 2,
      pixelRatio: PNG_PIXEL_RATIO,
      backgroundColor: "#ffffff",
    });
    expect(opts.style!.transform).toBe(
      `translate(${EXPORT_MARGIN - 10}px, ${EXPORT_MARGIN - 20}px) scale(1)`,
    );
    expect(c.classList.contains("arch-static")).toBe(false);
    await renderDiagramImage(c, nodes, "svg");
    expect(toSvg).toHaveBeenCalledOnce();
  });

  it("restores the canvas when rendering fails, and needs a rendered viewport", async () => {
    const c = canvas();
    c.style.setProperty("--arch-canvas", "#000000");
    vi.mocked(toSvg).mockRejectedValueOnce(new Error("boom"));
    await expect(renderDiagramImage(c, nodes, "svg")).rejects.toThrow("boom");
    expect(c.classList.contains("arch-static")).toBe(false);
    expect(vi.mocked(toSvg).mock.lastCall![1]!.backgroundColor).toBe("#000000");
    await expect(renderDiagramImage(document.createElement("div"), nodes, "png")).rejects.toThrow(
      "Diagram is not rendered",
    );
  });

  it("downloads through a temporary link", () => {
    const clicked: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(`${this.download}|${this.href}`);
    });
    downloadDataUrl("data:image/png;base64,AA", "d.png");
    expect(clicked).toEqual(["d.png|data:image/png;base64,AA"]);
    expect(document.querySelector("a")).toBeNull();
    spy.mockRestore();
  });
});
