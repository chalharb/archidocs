/**
 * Autosaved layout drafts (RELI-10, RELI-11, FAIL-02).
 *
 * Drafts live in `<root>/.archidoc/drafts/<diagram>.json`, inside the workspace
 * root (SEC-02) but outside discovery (hidden directory) and Git (.gitignore).
 * A draft records the layout-file revision it was based on, so recovery can tell
 * a compatible draft from one that conflicts with external edits (FAIL-03).
 */
import { z } from "zod";
import type { CanonicalDiagram } from "@/domain/model";
import {
  edgePresentationSchema,
  idSchema,
  layoutSettingsOverridesSchema,
  nodePlacementSchema,
} from "@/domain/schema/resource-schemas";
import type { WorkspaceRoot } from "../fs/workspace-root";
import type { LayoutEdit } from "./layout-writer";
import type { Revision } from "./revision";

export const STATE_DIR = ".archidoc";
export const DRAFTS_DIR = `${STATE_DIR}/drafts`;

const draftSchema = z.strictObject({
  version: z.literal(1),
  diagram: idSchema,
  baseRevision: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .nullable(),
  savedAt: z.iso.datetime(),
  layout: z.strictObject({
    settings: layoutSettingsOverridesSchema.optional(),
    nodes: z.record(idSchema, nodePlacementSchema).optional(),
    edges: z.record(idSchema, edgePresentationSchema).optional(),
  }),
});

export interface LayoutDraft {
  version: 1;
  diagram: string;
  baseRevision: Revision | null;
  savedAt: string;
  layout: LayoutEdit;
}

export type DraftState =
  | { status: "recoverable"; draft: LayoutDraft }
  | { status: "conflict"; draft: LayoutDraft; currentRevision: Revision | null }
  | { status: "incompatible"; draft: LayoutDraft; issues: string[] }
  | { status: "corrupt"; reason: string };

export function draftPath(diagramId: string): string {
  const id = idSchema.parse(diagramId); // restricts to a safe filename alphabet
  return `${DRAFTS_DIR}/${id}.json`;
}

export class DraftStore {
  constructor(
    private readonly root: WorkspaceRoot,
    private readonly maxBytes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async save(
    diagramId: string,
    baseRevision: Revision | null,
    layout: LayoutEdit,
  ): Promise<LayoutDraft> {
    const draft: LayoutDraft = {
      version: 1,
      diagram: diagramId,
      baseRevision,
      savedAt: this.now().toISOString(),
      layout,
    };
    const checked = draftSchema.parse(draft);
    await this.root.ensureDir(DRAFTS_DIR);
    if ((await this.root.readFileIfExists(`${STATE_DIR}/.gitignore`, 1024)) === null) {
      await this.root.writeFileAtomic(`${STATE_DIR}/.gitignore`, "*\n");
    }
    await this.root.writeFileAtomic(draftPath(diagramId), `${JSON.stringify(checked, null, 2)}\n`);
    return draft;
  }

  /** Load a draft; corrupt or unreadable drafts are reported, never thrown. */
  async load(diagramId: string): Promise<LayoutDraft | { corrupt: string } | null> {
    let text: string | null;
    try {
      text = await this.root.readFileIfExists(draftPath(diagramId), this.maxBytes);
    } catch (err) {
      return { corrupt: (err as Error).message };
    }
    if (text === null) return null;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { corrupt: "Draft file is not valid JSON" };
    }
    const parsed = draftSchema.safeParse(json);
    if (!parsed.success || parsed.data.diagram !== diagramId)
      return { corrupt: "Draft file does not match the draft format" };
    return parsed.data as LayoutDraft;
  }

  async discard(diagramId: string): Promise<void> {
    await this.root.remove(draftPath(diagramId));
  }
}

/** Decide whether a draft can be recovered against the current layout file and diagram (RELI-11). */
export function assessDraft(
  loaded: LayoutDraft | { corrupt: string },
  currentRevision: Revision | null,
  diagram: CanonicalDiagram | undefined,
): DraftState {
  if ("corrupt" in loaded) return { status: "corrupt", reason: loaded.corrupt };
  if (loaded.baseRevision !== currentRevision)
    return { status: "conflict", draft: loaded, currentRevision };
  const nodeIds = new Set(diagram?.nodes.map((n) => n.id) ?? []);
  const edgeIds = new Set(diagram?.edges.map((e) => e.id) ?? []);
  const issues = [
    ...(diagram ? [] : [`diagram '${loaded.diagram}' no longer exists`]),
    ...Object.keys(loaded.layout.nodes ?? {})
      .filter((id) => diagram && !nodeIds.has(id))
      .map((id) => `node '${id}' is no longer in the diagram`),
    ...Object.keys(loaded.layout.edges ?? {})
      .filter((id) => diagram && !edgeIds.has(id))
      .map((id) => `edge '${id}' is no longer in the diagram`),
  ];
  if (issues.length > 0) return { status: "incompatible", draft: loaded, issues };
  return { status: "recoverable", draft: loaded };
}
