/** A problem found in a file, reported with the place it was found. */
export interface Diagnostic {
  severity: "error" | "warning";
  /** File the problem was found in, relative to the workspace folder. */
  file?: string;
  /** Dotted path of the field at fault, such as `repository.url`. */
  path?: string;
  message: string;
}

/** A named diagram declared by a model file. */
export interface ViewSummary {
  id: string;
  title: string;
  group?: string;
}

/** What the build knows about one model file. */
export interface ModelFile {
  file: string;
  views: ViewSummary[];
  /** Present when the file is invalid; the file's views are then empty. */
  errors: Diagnostic[];
}

/** The data file the viewer loads at runtime. */
export interface SiteData {
  version: 1;
  name: string;
  title: string;
  base: string;
  files: ModelFile[];
}
