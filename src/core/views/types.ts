import type { BundleElement, BundleLens, BundleRelationship } from "../../schema/bundle.ts";

/** The most nodes a View may have before `oversized-view` warns. */
export const MAX_VIEW_NODES = 150;

/** The kinds of Structural View: the three levels, and the Deployment View. */
export type ViewKind = "c1" | "c2" | "c3" | "deployment";

/** How Compare marks a node or edge of a View between two Bundles. */
export type CompareMark = "added" | "removed" | "changed" | "unchanged";

/**
 * One node of a resolved View: an Element, drawn as a box or as a container.
 * A Deployment View also has Deployment Targets (`target`), Deployments
 * (`deployment`, id `<service>@<target>`) and the System boxes inside each
 * Target (`system`, id `<system>@<target>`).
 */
export interface ViewNode {
  id: string;
  kind: BundleElement["kind"] | "target" | "deployment";
  name: string;
  /** The Element a Deployment or a Target's System box draws, when the node's id is not that Element's. */
  element?: string;
  /** A Deployment's Deployment Target. */
  target?: string;
  /** The nearest ancestor that is itself a node of this View, else null. */
  parent: string | null;
  /** True when the Element has children in the Model that this View hides inside it. */
  collapsed: boolean;
  /** True for an External System or Service. */
  external: boolean;
  /** Set on every node of a View with a Lens: whether the Lens hits it, and for an impact Lens its nearest distance. */
  mark?: NodeMark;
  /** Set on every node of a View drawn for Compare (`compareView`). */
  change?: CompareMark;
}

/** How a Lens marks a node; a collapsed box is hit when anything inside it is. */
export interface NodeMark {
  hit: boolean;
  distance?: number;
  /** For an impact Lens: the origin itself, or the side of it the node sits on, at its nearest distance. */
  side?: ImpactSide;
}

export type ImpactSide = "origin" | "upstream" | "downstream";

/** The way a View draws: top to bottom, bottom to top, left to right or right to left. */
export type ViewDirection = "TB" | "BT" | "LR" | "RL";

/** An edge between two nodes, with the declared Relationships beneath it. */
export interface ViewEdge {
  from: string;
  to: string;
  relationships: BundleRelationship[];
  /** Set on every edge of a View with a Lens: whether the Lens lights it. */
  lit?: boolean;
  /** Set on every edge of a View drawn for Compare (`compareView`). */
  change?: CompareMark;
}

/** A Structural View resolved to nodes and edges, sorted by id and by `from`, then `to`. */
export interface ResolvedView {
  id: string;
  kind: ViewKind;
  title: string;
  /** The way the View draws: a Saved View's own, else `TB` for a Deployment View, else `LR`. */
  direction: ViewDirection;
  /** A Deployment View's Environment. */
  environment?: string;
  /** A Saved View's Lens, if it carries one. */
  lens?: BundleLens;
  nodes: ViewNode[];
  edges: ViewEdge[];
}

export interface ResolveOptions {
  /**
   * Systems and Services to open, showing their children; viewer state, not a
   * different View. A box opens only while it is itself shown, so a Service
   * stays shut inside a closed System. C1 opens nothing.
   */
  expand?: readonly string[];
  /**
   * Systems the C2 Landscape shows closed; it opens every other System.
   * Viewer state, like `expand`, and read by no other View. A System that is
   * also in `expand` is open.
   */
  collapse?: readonly string[];
  /**
   * The Lens over the View, which marks nodes and lights edges without
   * changing which nodes the View holds: `"own"` (the default) is a Saved
   * View's own Lens and none on any other View, `"none"` is no Lens, and a
   * given Lens replaces the View's own.
   */
  lens?: LensChoice;
}

/** Which Lens a View is resolved with: its own, none, or this one. */
export type LensChoice = "own" | "none" | BundleLens;

/** The kinds a View is listed under: a Saved Structural View's is its `level`. */
export type ListedKind = ViewKind | "dynamic";

/** A View as listed, without its nodes and edges. */
export interface ViewSummary {
  id: string;
  kind: ListedKind;
  title: string;
}
