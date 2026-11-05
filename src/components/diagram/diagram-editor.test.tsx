import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeView } from "../../../tests/helpers/view";
import type { DiagramView } from "@/server/workspace/repository";
import { api } from "./api";
import { DiagramEditor } from "./diagram-editor";
import { downloadDataUrl, renderDiagramImage } from "./export";

vi.mock("./api", async (orig) => ({
  ...(await orig<typeof import("./api")>()),
  api: {
    diagram: vi.fn(),
    entity: vi.fn(() => new Promise(() => {})),
    saveLayout: vi.fn(),
    saveDraft: vi.fn(async () => ({})),
    discardDraft: vi.fn(async () => undefined),
    eventsUrl: (ws: string) => `/api/workspaces/${ws}/events`,
  },
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./export", () => ({
  renderDiagramImage: vi.fn(async () => "data:image/png;base64,AA"),
  downloadDataUrl: vi.fn(),
}));

class FakeEventSource {
  static last: FakeEventSource | null = null;
  listeners: Array<() => void> = [];
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(_type: string, fn: () => void) {
    this.listeners.push(fn);
  }
  close() {
    this.closed = true;
  }
  emit() {
    for (const l of this.listeners) l();
  }
}

const m = vi.mocked(api);
const REV = `sha256:${"b".repeat(64)}`;

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  m.saveLayout.mockResolvedValue({ path: "d.layout.yaml", revision: REV, version: 2 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Two view instances of `api`, so `focus` selects two nodes. */
const TWO_INSTANCES =
  "[{entity: sys}, {id: a1, entity: api}, {id: a2, entity: api}, {entity: db}, {entity: user}]";

function setup(view: DiagramView = makeView(), focus?: string, mode: "view" | "edit" = "edit") {
  m.diagram.mockResolvedValue(view);
  return render(
    <DiagramEditor
      workspace="ws"
      initialView={view}
      diagrams={[{ id: "d", name: "Payments" }]}
      mode={mode}
      {...(focus ? { focus } : {})}
    />,
  );
}

const status = () => screen.getByRole("status");
const button = (name: string) => screen.getByRole("button", { name });

describe("diagram editor", () => {
  it("renders the diagram, settings and diagnostics", () => {
    setup();
    for (const id of ["sys", "api", "db", "user"])
      expect(screen.getByTestId(`node-${id}`)).toBeInTheDocument();
    expect(status()).toHaveTextContent("All changes saved");
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByText("No problems found.")).toBeInTheDocument();
    expect(screen.getByText(/Select a node or edge/)).toBeInTheDocument();
    expect(FakeEventSource.last!.url).toBe("/api/workspaces/ws/events");
  });

  it("aligns the selection, undoes, redoes, and saves (E2E-02 flow)", async () => {
    setup(makeView({ nodes: TWO_INSTANCES }), "api");
    expect(button("Align left")).toBeEnabled();
    fireEvent.click(button("Align left"));
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.click(button("Undo"));
    expect(status()).toHaveTextContent("All changes saved");
    fireEvent.click(button("Redo"));
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.click(button("Save layout"));
    await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
    const [ws, d, base, layout] = m.saveLayout.mock.lastCall!;
    expect([ws, d, base]).toEqual(["ws", "d", `sha256:${"a".repeat(64)}`]);
    expect(layout.nodes!.a1!.x).toBe(layout.nodes!.a2!.x);
    // Our own save arriving as a change event is not reported as external.
    act(() => FakeEventSource.last!.emit());
    act(() => FakeEventSource.last!.emit());
    await waitFor(() => expect(m.diagram).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/changed on disk/)).toBeNull();
  });

  it("distributes the selection", () => {
    setup(makeView({ nodes: TWO_INSTANCES }), "api");
    expect(button("Distribute horizontally")).toBeDisabled();
  });

  it("changes settings and reverts them", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "LEFT" } });
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.click(button("Revert"));
    expect(status()).toHaveTextContent("All changes saved");
    expect(screen.getByLabelText("Direction")).toHaveValue("DOWN");
  });

  it("re-lays out every node with ELK (LAYOUT-12)", async () => {
    setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Re-layout all" })[0]!);
    await waitFor(() => expect(status()).toHaveTextContent("Unsaved changes"));
  });

  it("shows conflicts and can discard local changes", async () => {
    m.saveLayout.mockRejectedValueOnce({
      status: 409,
      code: "CONFLICT",
      message: "Changed outside",
    });
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Save layout"));
    await screen.findByText("Layout file changed outside the editor");
    expect(screen.getByText("Changed outside")).toBeInTheDocument();
    fireEvent.click(button("Discard my changes and reload"));
    await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
    expect(screen.queryByText("Layout file changed outside the editor")).toBeNull();
  });

  it("reports validation and network errors on save", async () => {
    m.saveLayout.mockRejectedValueOnce({
      status: 422,
      code: "INVALID",
      message: "Layout is invalid",
      issues: ["nodes.x: bad"],
    });
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Save layout"));
    await screen.findByText("Layout not saved");
    expect(screen.getByText("nodes.x: bad")).toBeInTheDocument();
    m.saveLayout.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(button("Save layout"));
    await screen.findByText("The server could not be reached.");
  });

  it("exports PNG and SVG", async () => {
    setup();
    fireEvent.click(button("PNG"));
    await waitFor(() => expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), "d.png"));
    fireEvent.click(button("SVG"));
    await waitFor(() => expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), "d.svg"));
    expect(vi.mocked(renderDiagramImage).mock.calls.map((c) => c[2])).toEqual(["png", "svg"]);
  });

  it("restores or discards autosaved drafts (RELI-11)", async () => {
    const draft = {
      version: 1 as const,
      diagram: "d",
      baseRevision: null,
      savedAt: "2026-11-05T10:00:00.000Z",
      layout: { nodes: { user: { x: 999, y: 999 } } },
    };
    const { unmount } = setup(
      makeView({ persistence: { draft: { status: "recoverable", draft } } }),
    );
    expect(screen.getByText("Unsaved layout changes found")).toBeInTheDocument();
    fireEvent.click(button("Restore"));
    expect(status()).toHaveTextContent("Unsaved changes");
    expect(screen.queryByText("Unsaved layout changes found")).toBeNull();
    unmount();

    setup(
      makeView({
        persistence: { draft: { status: "conflict", draft, currentRevision: null } },
      }),
    );
    expect(screen.getByText(/layout file has changed since/)).toBeInTheDocument();
    fireEvent.click(button("Discard draft"));
    expect(m.discardDraft).toHaveBeenCalledWith("ws", "d");
    expect(screen.queryByText("Unsaved layout changes found")).toBeNull();
  });

  it("explains incompatible and corrupt drafts", () => {
    const draft = {
      version: 1 as const,
      diagram: "d",
      baseRevision: null,
      savedAt: "2026-11-05T10:00:00.000Z",
      layout: {},
    };
    const { unmount } = setup(
      makeView({ persistence: { draft: { status: "incompatible", draft, issues: ["gone"] } } }),
    );
    expect(screen.getByText(/no longer matches this diagram: gone/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    unmount();
    setup(makeView({ persistence: { draft: { status: "corrupt", reason: "bad json" } } }));
    expect(screen.getByText(/could not be read: bad json/)).toBeInTheDocument();
  });

  it("is read-only when the layout file can't be written", () => {
    setup(makeView({ persistence: { writable: false, notWritableReason: "Shared file" } }));
    expect(screen.getByText("Layout is read-only")).toBeInTheDocument();
    expect(screen.getByText("Shared file")).toBeInTheDocument();
    expect(screen.getByLabelText("Direction")).toBeDisabled();
  });

  it("shows stale models and orphaned overrides (DIAG-10, LAYOUT-13)", () => {
    setup(
      makeView({
        modelStatus: "stale",
        saved: {
          nodes: { user: { x: 0, y: 0 }, ghost: { x: 1, y: 1 } },
          edges: { old: { type: "step" } },
        },
      }),
    );
    expect(screen.getByText("Showing the last valid model")).toBeInTheDocument();
    expect(screen.getByText(/'ghost', 'old'/)).toBeInTheDocument();
  });

  it("reloads on external changes and keeps unsaved edits (E2E-04 flow)", async () => {
    setup();
    act(() => FakeEventSource.last!.emit()); // initial event is ignored
    expect(m.diagram).not.toHaveBeenCalled();

    const renamed = makeView();
    renamed.diagram.nodes[1] = { ...renamed.diagram.nodes[1]!, label: "Payments Gateway" };
    m.diagram.mockResolvedValueOnce(renamed);
    act(() => FakeEventSource.last!.emit());
    await screen.findByText(/reloaded because its files changed on disk/);
    expect(screen.getByTestId("node-api")).toHaveTextContent("Payments Gateway");
    fireEvent.click(button("Dismiss"));

    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    m.diagram.mockResolvedValueOnce(makeView({ saved: { settings: { gridSize: 40 } } }));
    act(() => FakeEventSource.last!.emit());
    await screen.findByText(/unsaved layout changes were kept/);
    expect(status()).toHaveTextContent("Unsaved changes");
    expect(screen.getByLabelText("Direction")).toHaveValue("UP");
    expect(screen.getByLabelText("Grid size")).toHaveValue(40);

    m.diagram.mockRejectedValueOnce({ status: 404, code: "DIAGRAM_NOT_FOUND", message: "gone" });
    act(() => FakeEventSource.last!.emit());
    await screen.findByText(/no longer available/);
  });

  it("keeps undo history unless the layout file changed on disk", async () => {
    setup();
    // Change and revert: clean, but with history to undo.
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Revert"));
    expect(button("Undo")).toBeEnabled();
    act(() => FakeEventSource.last!.emit());
    m.diagram.mockResolvedValueOnce(makeView());
    act(() => FakeEventSource.last!.emit());
    await waitFor(() => expect(m.diagram).toHaveBeenCalledOnce());
    expect(button("Undo")).toBeEnabled();
    expect(screen.queryByText(/changed on disk/)).toBeNull();

    m.diagram.mockResolvedValueOnce(
      makeView({
        saved: { edges: { "api-db": { type: "step" } } },
        persistence: { revision: `sha256:${"c".repeat(64)}` },
      }),
    );
    act(() => FakeEventSource.last!.emit());
    await screen.findByText(/reloaded because its files changed on disk/);
    expect(button("Undo")).toBeDisabled();
  });

  it("supports keyboard shortcuts for undo, redo and save", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(status()).toHaveTextContent("All changes saved");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "y", metaKey: true });
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.keyDown(window, { key: "z" }); // no modifier: ignored
    fireEvent.keyDown(screen.getByLabelText("Grid size"), { key: "z", ctrlKey: true }); // in a field
    fireEvent.keyDown(window, { key: "q", ctrlKey: true }); // not a shortcut
    expect(status()).toHaveTextContent("Unsaved changes");
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(m.saveLayout).toHaveBeenCalledOnce());
    await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
  });

  it("autosaves a draft and warns before leaving with unsaved changes", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    await waitFor(() => expect(m.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(m.saveDraft.mock.lastCall![3].settings).toEqual({ direction: "UP" });
  });

  it("works without EventSource support", () => {
    vi.stubGlobal("EventSource", undefined);
    FakeEventSource.last = null;
    setup();
    expect(FakeEventSource.last).toBeNull();
  });
});

describe("leaving the editor (ADD-007)", () => {
  it("goes straight back to the view when nothing is unsaved", () => {
    setup();
    fireEvent.click(button("Done"));
    expect(push).toHaveBeenCalledWith("/workspaces/ws/diagrams/d");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks to save, discard or keep editing when there are unsaved changes", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Done"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Unsaved layout changes.");
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(button("Keep editing"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(status()).toHaveTextContent("Unsaved changes");

    fireEvent.click(button("Done"));
    fireEvent.click(button("Save and close"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/workspaces/ws/diagrams/d"));
    expect(m.saveLayout).toHaveBeenCalledOnce();
  });

  it("stays in the editor when saving fails", async () => {
    m.saveLayout.mockRejectedValueOnce({ status: 409, code: "CONFLICT", message: "Changed" });
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Done"));
    fireEvent.click(button("Save and close"));
    await screen.findByText("Layout file changed outside the editor");
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("discards changes and the autosaved draft", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "UP" } });
    fireEvent.click(button("Done"));
    fireEvent.click(button("Discard changes"));
    expect(m.discardDraft).toHaveBeenCalledWith("ws", "d");
    expect(push).toHaveBeenCalledWith("/workspaces/ws/diagrams/d");
    expect(status()).toHaveTextContent("All changes saved");
  });
});

describe("read-only view (DIAG-12)", () => {
  it("shows the diagram without layout controls", () => {
    setup(makeView(), undefined, "view");
    expect(screen.getByTestId("node-api")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Diagram tools" })).toBeInTheDocument();
    for (const name of ["Undo", "Align left", "Re-layout all", "Save layout", "Done"])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByLabelText("Direction")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("link", { name: "Edit layout" })).toHaveAttribute(
      "href",
      "/workspaces/ws/diagrams/d/edit",
    );
    // No editing shortcuts, drafts or leave warnings.
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(m.saveLayout).not.toHaveBeenCalled();
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(false);
  });

  it("opens inspection for the focused entity and closes it until the selection changes", () => {
    setup(makeView(), "api", "view");
    const panel = screen.getByRole("complementary", { name: "Diagram details" });
    expect(panel).toHaveTextContent("Payments API");
    fireEvent.click(button("Close panel"));
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("collapses diagnostics into an indicator that expands", () => {
    setup(
      makeView({
        nodes: "[{entity: sys}, {entity: api}, {entity: db}, {entity: user}, {entity: ghost}]",
        saved: { nodes: { user: { x: 0, y: 0 }, gone: { x: 1, y: 1 } } },
      }),
      undefined,
      "view",
    );
    const toggle = button("1 problem");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("complementary", { name: "Diagram details" });
    expect(panel).toHaveTextContent("Orphaned layout overrides");
    expect(panel).toHaveTextContent("unknown entity 'ghost'");
    fireEvent.click(toggle);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("always shows a stale model, and reload notices, above the canvas", async () => {
    setup(makeView({ modelStatus: "stale" }), undefined, "view");
    expect(screen.getByText("Showing the last valid model")).toBeInTheDocument();
    act(() => FakeEventSource.last!.emit());
    const renamed = makeView({ modelStatus: "stale" });
    renamed.diagram.nodes[1] = { ...renamed.diagram.nodes[1]!, label: "Payments Gateway" };
    m.diagram.mockResolvedValueOnce(renamed);
    act(() => FakeEventSource.last!.emit());
    await screen.findByText(/reloaded because its files changed on disk/);
    expect(screen.getByTestId("node-api")).toHaveTextContent("Payments Gateway");
  });

  it("disables editing with the reason when the layout file isn't writable", () => {
    setup(
      makeView({ persistence: { writable: false, notWritableReason: "Shared file" } }),
      undefined,
      "view",
    );
    expect(button("Edit layout")).toBeDisabled();
    expect(screen.getByText("Shared file")).toBeInTheDocument();
  });

  it("exports from the view", async () => {
    setup(makeView(), undefined, "view");
    fireEvent.click(button("PNG"));
    await waitFor(() => expect(downloadDataUrl).toHaveBeenCalledWith(expect.any(String), "d.png"));
    fireEvent.click(button("Fit to view"));
  });
});
