import { Position, ReactFlowProvider } from "@xyflow/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedEdge } from "@/domain/diagram-resolve";
import { EDGE_TYPES } from "@/domain/resources";
import { makeView } from "../../../tests/helpers/view";
import { ArchEdge, edgePath } from "./edges";
import { EditorCallbacks } from "./editor-context";
import { BoundaryNode, ElementNode } from "./nodes";

const internal = vi.hoisted(() => ({
  nodes: {} as Record<string, unknown>,
}));
vi.mock("@xyflow/react", async (orig) => ({
  ...(await orig<typeof import("@xyflow/react")>()),
  useInternalNode: (id: string) => internal.nodes[id],
}));

const view = makeView();
const byId = Object.fromEntries(view.diagram.nodes.map((n) => [n.id, n]));
const common = {
  type: "element",
  dragging: false,
  zIndex: 0,
  selectable: true,
  deletable: false,
  draggable: true,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as const;

describe("node renderers", () => {
  it("renders an element with its style, title, technology and description (DIAG-08, DIAG-11)", () => {
    render(
      <ReactFlowProvider>
        <ElementNode
          id="api"
          data={{ node: byId.api! }}
          selected={false}
          width={220}
          height={120}
          {...common}
        />
      </ReactFlowProvider>,
    );
    const el = screen.getByTestId("node-api");
    expect(el).toHaveAttribute("data-entity-id", "api");
    expect(el).toHaveAttribute("data-color", "primary");
    expect(el).toHaveStyle({ width: "220px", height: "120px" });
    expect(el).toHaveTextContent("Payments API[Go]Takes payments");
    render(
      <ReactFlowProvider>
        <ElementNode id="user" data={{ node: byId.user! }} selected={false} {...common} />
      </ReactFlowProvider>,
    );
    expect(screen.getByTestId("node-user")).toHaveStyle({ width: "200px" });
  });

  it("renders a boundary with a resizer only when selected and editable (LAYOUT-14)", () => {
    const onResized = vi.fn();
    const { container, rerender } = render(
      <ReactFlowProvider>
        <EditorCallbacks.Provider value={{ readOnly: false, staticEdges: false, onResized }}>
          <BoundaryNode id="sys" data={{ node: byId.sys! }} selected {...common} type="boundary" />
        </EditorCallbacks.Provider>
      </ReactFlowProvider>,
    );
    expect(screen.getByTestId("node-sys")).toHaveTextContent("Paymentssoftware-system");
    expect(container.querySelector(".react-flow__resize-control")).not.toBeNull();
    rerender(
      <ReactFlowProvider>
        <EditorCallbacks.Provider value={{ readOnly: true, staticEdges: false, onResized }}>
          <BoundaryNode
            id="sys"
            data={{ node: { ...byId.sys!, technology: "Kubernetes" } }}
            selected
            {...common}
            type="boundary"
          />
        </EditorCallbacks.Provider>
      </ReactFlowProvider>,
    );
    expect(container.querySelector(".react-flow__resize-control")).toBeNull();
    expect(screen.getByTestId("node-sys")).toHaveTextContent("[Kubernetes]");
  });
});

describe("edge renderers (LAYOUT-07, LAYOUT-25)", () => {
  const p = {
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 200,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  };

  it("draws a distinct path for each edge type", () => {
    const paths = EDGE_TYPES.map((t) => edgePath(t, p)[0]);
    expect(new Set(paths).size).toBe(EDGE_TYPES.length);
    expect(edgePath("straight", p)[0]).toBe("M 0,0L 100,200");
    expect(edgePath("bezier", p)[0]).toMatch(/^M0,0 C/);
  });

  const edge = view.diagram.edges.find((e) => e.id === "api-db")! as ResolvedEdge;
  const box = (x: number, y: number) => ({
    internals: { positionAbsolute: { x, y } },
    measured: { width: 200, height: 100 },
  });
  const props = {
    id: "api-db",
    source: "api",
    target: "db",
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    selected: false,
    animated: false,
    deletable: false,
    selectable: true,
  };

  function renderEdge(data: Record<string, unknown> | undefined, staticEdges = false) {
    return render(
      <ReactFlowProvider>
        <EditorCallbacks.Provider value={{ readOnly: false, staticEdges, onResized: vi.fn() }}>
          <svg>
            <ArchEdge {...props} data={data as never} />
          </svg>
        </EditorCallbacks.Provider>
      </ReactFlowProvider>,
    );
  }

  it("floats between node borders with style, label and optional flow", () => {
    internal.nodes = {
      api: box(0, 0),
      db: { ...box(400, 0), measured: {}, width: 200, height: 100 },
    };
    renderEdge({ edge, edgeType: "straight", animated: true });
    const g = screen.getByTestId("edge-api-db");
    expect(g).toHaveAttribute("data-color", edge.style.color);
    expect(g).toHaveAttribute("data-edge-type", "straight");
    expect(g.querySelector(".arch-edge-path")).toHaveAttribute("d", "M 200,50L 400,50");
    expect(g.querySelector(".arch-edge-path")).toHaveAttribute("data-line", "dashed");
    expect(screen.getByTestId("edge-flow-api-db")).toBeInTheDocument();
  });

  it("is static while exporting and renders nothing without both nodes", () => {
    internal.nodes = { api: box(0, 0), db: box(0, 400) };
    const labelled = { ...edge, label: "Writes" };
    const { unmount } = renderEdge({ edge: labelled, edgeType: "step", animated: true }, true);
    expect(screen.queryByTestId("edge-flow-api-db")).toBeNull();
    unmount();
    internal.nodes = { api: box(0, 0) };
    renderEdge({ edge, edgeType: "bezier", animated: false });
    expect(screen.queryByTestId("edge-api-db")).toBeNull();
    internal.nodes = { api: box(0, 0), db: box(0, 400) };
    renderEdge(undefined);
    expect(screen.queryByTestId("edge-api-db")).toBeNull();
  });
});
