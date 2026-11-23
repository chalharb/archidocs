import { useEffect, useMemo, useState } from "react";
import type { TreeRow, Workspace } from "./workspace.ts";

type Panel = "Model" | "Views" | "Teams";
type Grouping = "kind" | "team";

export interface RailProps {
  workspace: Workspace;
  view: string;
  selected: string | null;
  onPickElement: (id: string) => void;
  onPickView: (id: string) => void;
  onPickTeam: (id: string) => void;
  onFind: () => void;
}

/** The rail: Find, then Model, Views and Teams open as a flyout over the canvas, and close on a pick or Escape. */
export function Rail({ workspace, view, selected, onPickElement, onPickView, onPickTeam, onFind }: RailProps) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [grouping, setGrouping] = useState<Record<"Model" | "Views", Grouping>>({ Model: "kind", Views: "kind" });

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
      <nav className="ad-rail" aria-label="Rail">
        <button type="button" className="ad-rail-button" aria-keyshortcuts="/" onClick={() => (setPanel(null), onFind())}>
          <span className="ad-rail-icon ad-rail-find" aria-hidden="true" />
          Find
        </button>
        {(["Model", "Views", "Teams"] as const).map((name) => (
          <button key={name} type="button" className="ad-rail-button" aria-expanded={panel === name} onClick={() => setPanel(panel === name ? null : name)}>
            <span className={`ad-rail-icon ad-rail-${name.toLowerCase()}`} aria-hidden="true" />
            {name}
          </button>
        ))}
      </nav>
      {panel === "Teams" && (
        <>
          <div className="ad-scrim" onClick={() => setPanel(null)} />
          <section className="ad-flyout" role="dialog" aria-label="Teams">
            <header className="ad-flyout-head">
              <h2>Teams</h2>
            </header>
            <ul className="ad-team-list">
              {[...workspace.bundle.teams]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((team) => {
                  const style = workspace.teams.get(team.id);
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        className="ad-row-label"
                        onClick={() => {
                          setPanel(null);
                          onPickTeam(team.id);
                        }}
                      >
                        <span className="ad-row-team" style={{ borderColor: style?.color }}>
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
          <div className="ad-scrim" onClick={() => setPanel(null)} />
          <section className="ad-flyout" role="dialog" aria-label={panel}>
            <header className="ad-flyout-head">
              <h2>{panel}</h2>
              <div className="ad-segmented" role="radiogroup" aria-label="Group">
                {(["kind", "team"] as const).map((g) => (
                  <label key={g}>
                    <input type="radio" name={`group-${panel}`} checked={grouping[panel] === g} onChange={() => setGrouping({ ...grouping, [panel]: g })} />
                    <span>{g === "kind" ? "By kind" : "By Team"}</span>
                  </label>
                ))}
              </div>
            </header>
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
        <div className={isCurrent(row) ? "ad-row ad-current" : "ad-row"} style={{ paddingLeft: 8 + (level - 1) * 14 }}>
          {row.children.length > 0 ? (
            <button type="button" className={expanded ? "ad-disclosure ad-open" : "ad-disclosure"} aria-label={`${expanded ? "Collapse" : "Expand"} ${row.label}`} onClick={() => toggle(row.key)} />
          ) : (
            <span className="ad-disclosure-space" />
          )}
          <button
            type="button"
            className={pickable ? "ad-row-label" : "ad-row-label ad-group"}
            data-glyph={row.glyph}
            aria-current={isCurrent(row) ? "page" : undefined}
            onClick={() => (pickable ? onPick(row) : toggle(row.key))}
          >
            {row.label}
          </button>
          {row.children.length > 0 && <span className="ad-count">{row.children.length}</span>}
          {row.team && (
            <span className="ad-row-team" style={{ borderColor: row.team.color }}>
              {row.team.code}
            </span>
          )}
        </div>
        {expanded && <ul role="group">{row.children.map((c) => item(c, level + 1))}</ul>}
      </li>
    );
  };

  return (
    <ul className="ad-tree" role="tree" aria-label={label}>
      {rows.map((r) => item(r, 1))}
    </ul>
  );
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
