import { useEffect, useMemo, useState } from "react";
import type { Screen } from "../../src/core/save-as-view.ts";
import type { Workspace } from "./workspace.ts";

export interface SaveAsViewProps {
  workspace: Workspace;
  screen: Screen;
  /** The title the form starts with: the View's own. */
  title: string;
  onClose: () => void;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "view";

/**
 * Save as View: the screen as Saved View YAML for a Project's file, and the
 * matching `upsert_view` call for an agent, both from the core engine's
 * `saveAsView`, which resolves to the same nodes as the screen.
 */
export function SaveAsView({ workspace, screen, title: initialTitle, onClose }: SaveAsViewProps) {
  const projects = useMemo(() => [...workspace.bundle.projects].sort((a, b) => a.name.localeCompare(b.name)), [workspace]);
  const own = workspace.bundle.views.find((v) => v.id === screen.view)?.project;
  const [project, setProject] = useState(own ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [id, setId] = useState(slug(initialTitle));
  // The core engine refuses a screen it can't save (picks on a Deployment View); the dialog says why.
  const saved = useMemo(() => {
    if (!project) return undefined;
    try {
      return workspace.saveAsView(screen, { project, id: id || "view", title: title || "View" });
    } catch (e) {
      return { problem: e instanceof Error ? e.message : String(e) };
    }
  }, [workspace, screen, project, id, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="ad-scrim" onClick={onClose} />
      <section className="ad-dialog" role="dialog" aria-label="Save as View">
        <header className="ad-flyout-head">
          <h2>Save as View</h2>
          <button type="button" className="ad-chip-clear" aria-label="Close" onClick={onClose}>
            <span className="ad-chip-x" aria-hidden="true" />
          </button>
        </header>
        <div className="ad-form">
          <label>
            Project
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Id
            <input value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} />
          </label>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        {saved && "problem" in saved && (
          <p className="ad-snippet" role="alert">
            {saved.problem}
          </p>
        )}
        {saved && !("problem" in saved) && (
          <>
            <Snippet label="YAML" hint={`Add to a file in ${workspace.name(project)}`} text={saved.yaml} />
            <Snippet label="upsert_view call" hint="Or ask an agent to make this MCP call" text={JSON.stringify(saved.call, null, 2)} />
          </>
        )}
      </section>
    </>
  );
}

function Snippet({ label, hint, text }: { label: string; hint: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ad-snippet">
      <div className="ad-snippet-head">
        <span>
          <strong>{label}</strong> <span className="ad-muted">{hint}</span>
        </span>
        <button type="button" className="ad-tool" aria-label={`Copy ${label}`} onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre aria-label={label}>{text}</pre>
    </div>
  );
}
