import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ELEMENT_SHAPES } from "@/domain/resources";
import { ShapeOutline, contentInsets } from "./shapes";

describe("element shapes (DIAG-11)", () => {
  it.each(ELEMENT_SHAPES)("draws %s at the node's size with a filled outline", (shape) => {
    const { container } = render(<ShapeOutline shape={shape} width={200} height={100} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-shape", shape);
    expect(svg).toHaveAttribute("viewBox", "0 0 200 100");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector(".fill")).not.toBeNull();
    const insets = contentInsets(shape, 200, 100);
    for (const v of Object.values(insets)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("reserves room for shape details", () => {
    expect(contentInsets("person", 200, 100).top).toBeGreaterThan(
      contentInsets("rectangle", 200, 100).top,
    );
    expect(contentInsets("queue", 200, 100).right).toBeGreaterThan(
      contentInsets("rectangle", 200, 100).right,
    );
    expect(contentInsets("browser", 200, 100).top).toBe(28);
  });
});
