import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { search } from "../../src/core/search.ts";
import { GLYPH_ICON, Icon } from "./Icon.tsx";
import { GLYPHS, type Workspace } from "./workspace.ts";

const LIMIT = 30;

export interface FindProps {
  workspace: Workspace;
  /** Says what a pick does, such as "Pick the node to connect Web to". */
  prompt?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * Find (`/`): the core engine's `search` over name, id, Team, technology and
 * URL, the same function MCP's `search_elements` runs. Enter picks the first
 * result; Escape closes.
 */
export function Find({ workspace, prompt, onPick, onClose }: FindProps) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (query.trim() ? search(workspace.bundle, query, { fields: ["team", "technology"] }).slice(0, LIMIT) : []), [workspace, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="arc-scrim" onClick={onClose} />
      <section className="arc-flyout arc-find" role="dialog" aria-label="Find">
        <header className="arc-flyout-head">
          <h2>Find</h2>
          {prompt && <p className="arc-muted">{prompt}</p>}
        </header>
        <input
          ref={input}
          type="search"
          className="arc-find-input"
          placeholder="Name, id, Team, technology or URL"
          aria-label="Find"
          aria-controls="arc-find-results"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onPick(results[0].element.id);
          }}
        />
        <ul className="arc-results" id="arc-find-results" role="listbox" aria-label="Results">
          {results.map(({ element, deployment }) => {
            const team = workspace.teams.get(element.owner);
            return (
              <li key={element.id} role="option" aria-selected="false" tabIndex={-1} onClick={() => onPick(element.id)} onKeyDown={(e) => e.key === "Enter" && onPick(element.id)}>
                <span className="arc-result-name">
                  <Icon name={GLYPH_ICON[GLYPHS[element.kind]]!} className="arc-row-icon" />
                  {element.name}
                </span>
                <code className="arc-muted">{element.id}</code>
                {team && (
                  <span className="arc-row-team" style={{ "--team": team.color } as CSSProperties}>
                    {team.code}
                  </span>
                )}
                {deployment && (
                  <span className="arc-result-url">
                    {workspace.name(deployment.environment)} · {deployment.url}
                  </span>
                )}
              </li>
            );
          })}
          {!query.trim() && <li className="arc-empty">Start typing to see matching elements.</li>}
          {query.trim() && results.length === 0 && <li className="arc-empty">No matches</li>}
        </ul>
      </section>
    </>
  );
}
