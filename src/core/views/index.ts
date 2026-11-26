/**
 * The View module: any View id in, the View out. This index is the only
 * file of the folder to import from outside it; the resolvers behind it are
 * private. It runs in Node and in the browser.
 */
export { resolveView, checkView, listViews, generatedViews, pickedView, type AnyView } from "./resolve.ts";
export { compareView } from "./compare.ts";
export { saveAsView, type Screen, type SavedScreen, type SavedViewDefinition } from "./save-as-view.ts";
export { parseViewId, formatViewId, ownViewId, type ViewRef } from "./ids.ts";
export { describeLens } from "./lens.ts";
export { instancesChip, isScaled } from "./deployment.ts";
export { stepViews, dynamicViewsUsing, type DynamicResolution, type DynamicProblem, type ResolvedDynamicView, type ResolvedStep, type StepKind } from "./dynamic.ts";
export type { SavedResolution, BadExpand, UnresolvedPath } from "./saved.ts";
export {
  MAX_VIEW_NODES,
  type CompareMark,
  type ImpactSide,
  type LensChoice,
  type ListedKind,
  type NodeMark,
  type ResolveOptions,
  type ResolvedView,
  type ViewDirection,
  type ViewEdge,
  type ViewKind,
  type ViewNode,
  type ViewSummary,
} from "./types.ts";
