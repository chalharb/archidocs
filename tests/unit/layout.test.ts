import { describe, expect, it } from "vitest";
import { layoutGraph } from "../../src/layout/index.js";

describe("layout", () => {
  it("places connected nodes at distinct positions", async () => {
    const placed = await layoutGraph(
      [
        { id: "a", width: 100, height: 50 },
        { id: "b", width: 100, height: 50 },
      ],
      [{ id: "e", source: "a", target: "b" }],
    );
    expect(placed[0]?.x).not.toBe(placed[1]?.x);
  });
});
