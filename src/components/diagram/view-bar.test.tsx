import { describe, expect, it } from "vitest";
import { problemsLabel } from "./view-bar";

describe("problems indicator", () => {
  it("counts problems", () => {
    expect(problemsLabel(0)).toBe("No problems");
    expect(problemsLabel(1)).toBe("1 problem");
    expect(problemsLabel(4)).toBe("4 problems");
  });
});
