import { useEffect, useMemo, useState } from "react";
import type { TreeRow, Workspace } from "./workspace.ts";

type Panel = "Model" | "Views" | "Teams";

const GLYPHS: Record<Panel, string> = { Model: "☰", Teams: "⚑", Views: "▦" };
type Grouping = "kind" | "team";

export interface RailProps {
  workspace: Workspace;
  view: string;
  selected: string | null;
  onPickElement: (id: string) => void;
  onPickView: (id: string) => void;
  onPickTeam: (id: string) => void;
  /** Whether Find is open; only one of Find, Model, Views and Teams is open at a time. */
  finding: boolean;
  onFind: () => void;
  /** Called when Model, Views or Teams opens, so Find closes. */
  onOpenPanel: () => void;
}

/** The rail: Find, then Model, Views and Teams open as a flyout over the canvas, and close on a pick or Escape. */
export function Rail({ workspace, view, selected, onPickElement, onPickView, onPickTeam, finding, onFind, onOpenPanel }: RailProps) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [grouping, setGrouping] = useState<Record<"Model" | "Views", Grouping>>({ Model: "kind", Views: "kind" });

  // Find opened (from its button or the / key) closes any flyout.
  const [wasFinding, setWasFinding] = useState(finding);
  if (finding !== wasFinding) {
    setWasFinding(finding);
    if (finding) setPanel(null);
  }

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const rows = useMemo(() => {
    if (panel === "Model") return grouping.Model === "kind" ? workspace.modelByKind() : workspace.modelByTeam();
    if (panel === "Views") return grouping.Views === "kind" ? workspace.viewsByKind() : workspace.viewsByTeam();
    return [];
  }, [panel, grouping, workspace]);

  const current = (row: TreeRow) => (panel === "Views" ? row.view === view : row.element !== undefined && row.element === (selected ?? view.slice(3)));

  return (
    <>
      <nav className="arc-rail" aria-label="Rail">
        <div className="arc-logo" aria-hidden="true" title="Archidocs">
          A
        </div>
        <button type="button" className="arc-rail-button" title="Find ( / )" aria-label="Find" aria-keyshortcuts="/" aria-pressed={finding} onClick={() => (setPanel(null), onFind())}>
          <span aria-hidden="true">⌕</span>
        </button>
        {(["Model", "Teams", "Views"] as const).map((name) => (
          <button
            key={name}
            type="button"
            className="arc-rail-button"
            title={name}
            aria-label={name}
            aria-expanded={panel === name}
            onClick={() => {
              if (panel !== name) onOpenPanel();
              setPanel(panel === name ? null : name);
            }}
          >
            <span aria-hidden="true">{GLYPHS[name]}</span>
          </button>
        ))}
      </nav>
      {panel === "Teams" && (
        <>
          <div className="arc-scrim" onClick={() => setPanel(null)} />
          <section className="arc-flyout" role="dialog" aria-label="Teams">
            <header className="arc-flyout-head">
              <h2>Teams</h2>
              <Close onClose={() => setPanel(null)} />
            </header>
            <ul className="arc-team-list">
              {[...workspace.bundle.teams]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((team) => {
                  const style = workspace.teams.get(team.id);
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        className="arc-row-label"
                        onClick={() => {
                          setPanel(null);
                          onPickTeam(team.id);
                        }}
                      >
                        <span className="arc-row-team" style={{ borderColor: style?.color }}>
                          {style?.code}
                        </span>{" "}
                        {team.name}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        </>
      )}
      {panel && panel !== "Teams" && (
        <>
          <div className="arc-scrim" onClick={() => setPanel(null)} />
          <section className="arc-flyout" role="dialog" aria-label={panel}>
            <header className="arc-flyout-head">
              <h2>{panel}</h2>
              <Close onClose={() => setPanel(null)} />
            </header>
            <div className="arc-flyout-by">
              <div className="arc-segmented" role="radiogroup" aria-label="Group">
                {(["kind", "team"] as const).map((g) => (
                  <label key={g}>
                    <input type="radio" name={`group-${panel}`} checked={grouping[panel] === g} onChange={() => setGrouping({ ...grouping, [panel]: g })} />
                    <span>{g === "kind" ? "By kind" : "By Team"}</span>
                  </label>
                ))}
              </div>
            </div>
            <Tree
              key={`${panel}:${grouping[panel]}`}
              label={panel}
              rows={rows}
              isCurrent={current}
              onPick={(row) => {
                setPanel(null);
                if (row.view !== undefined) onPickView(row.view);
                else if (row.element !== undefined) onPickElement(row.element);
              }}
            />
          </section>
        </>
      )}
    </>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="arc-flyout-close" aria-label="Close" onClick={onClose}>
      ✕
    </button>
  );
}

/** A collapsible tree; the current row's branch starts open. */
function Tree({ label, rows, isCurrent, onPick }: { label: string; rows: TreeRow[]; isCurrent: (row: TreeRow) => boolean; onPick: (row: TreeRow) => void }) {
  const [openKeys, setOpenKeys] = useState(() => new Set(pathToCurrent(rows, isCurrent)));
  const toggle = (key: string) =>
    setOpenKeys((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const item = (row: TreeRow, level: number) => {
    const expanded = row.children.length > 0 ? openKeys.has(row.key) : undefined;
    const pickable = row.view !== undefined || row.element !== undefined;
    return (
      <li key={row.key} role="treeitem" aria-level={level} aria-expanded={expanded} aria-label={row.label} aria-selected={isCurrent(row)}>
        <div className={isCurrent(row) ? "arc-row arc-current" : "arc-row"} style={{ paddingLeft: 8 + (level - 1) * 14 }}>
          {row.children.length > 0 ? (
            <button type="button" className={expanded ? "arc-disclosure arc-open" : "arc-disclosure"} aria-label={`${expanded ? "Collapse" : "Expand"} ${row.label}`} onClick={() => toggle(row.key)} />
          ) : (
            <span className="arc-disclosure-space" />
          )}
          {viewTag(row) && <span className={`arc-vtag arc-vtag-${viewTag(row)!.toLowerCase()}`}>{viewTag(row)}</span>}
          <button
            type="button"
            className={pickable ? "arc-row-label" : "arc-row-label arc-group"}
            data-glyph={row.view === undefined ? row.glyph : undefined}
            aria-current={isCurrent(row) ? "page" : undefined}
            onClick={() => (pickable ? onPick(row) : toggle(row.key))}
          >
            {row.label}
          </button>
          {row.children.length > 0 && <span className="arc-count">{row.children.length}</span>}
          {row.team && (
            <span className="arc-row-team" style={{ borderColor: row.team.color }}>
              {row.team.code}
            </span>
          )}
        </div>
        {expanded && <ul role="group">{row.children.map((c) => item(c, level + 1))}</ul>}
      </li>
    );
  };

  return (
    <ul className="arc-tree" role="tree" aria-label={label}>
      {rows.map((r) => item(r, 1))}
    </ul>
  );
}

/** A View row's tag, as the scope ladder names it: C1, C2, C3, Env, Saved or Dyn. */
function viewTag(row: TreeRow): string | undefined {
  if (row.view === undefined) return undefined;
  if (row.glyph === "▶") return "Dyn";
  if (row.glyph === "◇") return "Saved";
  if (row.glyph === "⛁" || row.view.startsWith("deployment/")) return "Env";
  if (row.view === "c1") return "C1";
  if (row.view === "c2" || row.view.startsWith("c2/")) return "C2";
  if (row.view.startsWith("c3/")) return "C3";
  return undefined;
}

/** The keys of the rows above the current one, so its branch opens. */
function pathToCurrent(rows: TreeRow[], isCurrent: (row: TreeRow) => boolean, trail: string[] = []): string[] {
  for (const row of rows) {
    if (isCurrent(row)) return trail;
    const found = pathToCurrent(row.children, isCurrent, [...trail, row.key]);
    if (found.length > 0) return found;
  }
  return [];
}
