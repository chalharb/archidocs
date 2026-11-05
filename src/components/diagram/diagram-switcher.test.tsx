import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiagramSwitcher } from "./diagram-switcher";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("diagram switcher", () => {
  it("navigates to the chosen diagram", () => {
    render(
      <DiagramSwitcher
        workspace="my ws"
        current="a"
        diagrams={[
          { id: "a", name: "A" },
          { id: "b c", name: "B" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Diagram");
    expect(select).toHaveValue("a");
    fireEvent.change(select, { target: { value: "b c" } });
    expect(push).toHaveBeenCalledWith("/workspaces/my%20ws/diagrams/b%20c");
  });
});
