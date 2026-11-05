import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeView } from "../../../tests/helpers/view";
import { api } from "./api";
import { EdgeInspector, NodeInspector } from "./inspector";

vi.mock("./api", () => ({ api: { entity: vi.fn() } }));
const entity = vi.mocked(api.entity);

const view = makeView();
const apiNode = view.diagram.nodes.find((n) => n.id === "api")!;
const diagrams = [
  { id: "d", name: "Payments" },
  { id: "deploy", name: "Deployment" },
];

describe("node inspector (DIAG-07)", () => {
  beforeEach(() => entity.mockReset());

  it("shows canonical details and links to other diagrams", async () => {
    entity.mockResolvedValue({
      entity: {
        id: "api",
        name: "Payments API",
        type: "container",
        owner: "team-a",
        tags: ["pci"],
        properties: {},
      },
      children: [],
      outgoing: [],
      incoming: [],
      diagrams: ["d", "deploy", "unnamed"],
    } as never);
    render(<NodeInspector workspace="ws" diagramId="d" node={apiNode} diagrams={diagrams} />);
    expect(screen.getByRole("heading", { name: "Payments API" })).toBeInTheDocument();
    expect(screen.getByText("Takes payments")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("team-a")).toBeInTheDocument());
    expect(screen.getByText("pci")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Deployment" });
    expect(link).toHaveAttribute("href", "/workspaces/ws/diagrams/deploy?focus=api");
    expect(screen.getByRole("link", { name: "unnamed" })).toBeInTheDocument();
    expect(entity).toHaveBeenCalledWith("ws", "api");
  });

  it("says when no other diagram shows the entity, and reports errors", async () => {
    entity.mockResolvedValueOnce({
      entity: { id: "api", name: "Payments API", type: "container", tags: [], properties: {} },
      children: [],
      outgoing: [],
      incoming: [],
      diagrams: ["d"],
    } as never);
    const { unmount } = render(
      <NodeInspector workspace="ws" diagramId="d" node={apiNode} diagrams={diagrams} />,
    );
    await waitFor(() => expect(screen.getByText("No other diagrams.")).toBeInTheDocument());
    unmount();
    entity.mockRejectedValueOnce({ message: "Unknown entity 'api'" });
    render(<NodeInspector workspace="ws" diagramId="d" node={apiNode} diagrams={diagrams} />);
    await waitFor(() => expect(screen.getByText("Unknown entity 'api'")).toBeInTheDocument());
  });
});

describe("edge inspector", () => {
  const edge = view.diagram.edges.find((e) => e.id === "api-db")!;

  it("shows the relationship and edits per-edge presentation", () => {
    const onChange = vi.fn();
    render(
      <EdgeInspector
        edge={edge}
        readOnly={false}
        presentation={{ type: "step", animated: false }}
        effectiveType="smoothstep"
        effectiveAnimated={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("heading", { name: "reads" })).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.getByLabelText("Edge style")).toHaveValue("step");
    expect(screen.getByLabelText("Animation")).toHaveValue("off");
    fireEvent.change(screen.getByLabelText("Edge style"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ type: undefined });
    fireEvent.change(screen.getByLabelText("Edge style"), { target: { value: "bezier" } });
    expect(onChange).toHaveBeenLastCalledWith({ type: "bezier" });
    fireEvent.change(screen.getByLabelText("Animation"), { target: { value: "on" } });
    expect(onChange).toHaveBeenLastCalledWith({ animated: true });
    fireEvent.change(screen.getByLabelText("Animation"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ animated: undefined });
  });

  it("defaults to the diagram's settings", () => {
    const labelled = view.diagram.edges.find((e) => e.id === "user-api")!;
    render(
      <EdgeInspector
        edge={labelled}
        readOnly
        presentation={undefined}
        effectiveType="bezier"
        effectiveAnimated
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Pays" })).toBeInTheDocument();
    expect(screen.getByLabelText("Edge style")).toHaveValue("");
    expect(screen.getByLabelText("Edge style")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Diagram default (Bezier)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Diagram default (on)" })).toBeInTheDocument();
  });
});

describe("edge inspector in view mode", () => {
  it("hides presentation controls", () => {
    const edge = view.diagram.edges[0]!;
    render(
      <EdgeInspector
        edge={edge}
        readOnly
        presentation={undefined}
        effectiveType="bezier"
        effectiveAnimated={false}
        onChange={vi.fn()}
        presentationControls={false}
      />,
    );
    expect(screen.queryByLabelText("Edge style")).toBeNull();
    expect(screen.queryByLabelText("Animation")).toBeNull();
  });
});
