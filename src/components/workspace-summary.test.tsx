import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diagnostic } from "@/domain/diagnostics";
import { DiagnosticsList, location } from "./diagnostics-list";
import { WorkspaceSummary } from "./workspace-summary";

const err = diagnostic("error", "YAML_SYNTAX", "Bad indentation", {
  file: "a.yaml",
  line: 3,
  column: 2,
  path: ["nodes", 0],
  hint: "Fix it",
});
const warn = diagnostic("warning", "WORKSPACE_MISSING", "No workspace");

describe("DiagnosticsList", () => {
  it("shows an empty state", () => {
    render(<DiagnosticsList diagnostics={[]} />);
    expect(screen.getByText("No problems found.")).toBeInTheDocument();
  });

  it("renders severity, code, location, message and hint", () => {
    render(<DiagnosticsList diagnostics={[err, warn]} />);
    const items = within(screen.getByRole("list", { name: "Diagnostics" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("error");
    expect(items[0]).toHaveTextContent("YAML_SYNTAX");
    expect(items[0]).toHaveTextContent("a.yaml:3:2 (nodes[0])");
    expect(items[0]).toHaveTextContent("Fix it");
    expect(items[1]).toHaveTextContent("No workspace");
  });

  it("formats locations", () => {
    expect(location(warn)).toBe("");
    expect(location(diagnostic("info", "YAML_SYNTAX", "m", { file: "f", line: 1 }))).toBe("f:1");
    expect(location(diagnostic("info", "YAML_SYNTAX", "m", { path: ["id"] }))).toBe("(id)");
  });
});

describe("WorkspaceSummary", () => {
  it("renders a valid workspace with counts and diagrams", () => {
    render(
      <WorkspaceSummary
        workspaceKey="acme"
        name="ACME"
        status="valid"
        loadedAt="2026-01-01T00:00:00.000Z"
        counts={{ entities: 3, relationships: 2, diagrams: 1 }}
        diagrams={[{ id: "ctx", name: "Context", diagramType: "c4-context" }]}
        diagnostics={[]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("ACMEValid");
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics (0 errors, 0 warnings)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns that a stale model is shown (DIAG-10)", () => {
    render(<WorkspaceSummary workspaceKey="w" name="W" status="stale" diagnostics={[err]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Showing the last valid model");
    expect(screen.getByText("Diagnostics (1 errors, 0 warnings)")).toBeInTheDocument();
  });

  it("shows why a workspace is unavailable", () => {
    render(
      <WorkspaceSummary
        workspaceKey="w"
        name="w"
        status="unavailable"
        error="File not found: /x"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("File not found: /x");
    expect(screen.queryByText(/Diagnostics/)).not.toBeInTheDocument();
  });

  it("renders an invalid workspace without counts or diagrams", () => {
    render(<WorkspaceSummary workspaceKey="w" name="W" status="invalid" diagrams={[]} />);
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.queryByText("Diagrams")).not.toBeInTheDocument();
  });
});
