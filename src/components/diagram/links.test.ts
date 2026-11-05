import { describe, expect, it } from "vitest";
import { diagramHref } from "./links";

describe("diagram routes (DIAG-12)", () => {
  it("builds encoded view and edit URLs", () => {
    expect(diagramHref("my ws", "a/b")).toBe("/workspaces/my%20ws/diagrams/a%2Fb");
    expect(diagramHref("ws", "d", "edit")).toBe("/workspaces/ws/diagrams/d/edit");
    expect(diagramHref("ws", "d", "view", "e 1")).toBe("/workspaces/ws/diagrams/d?focus=e%201");
  });
});
