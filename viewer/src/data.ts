export interface ViewSummary {
  id: string;
  title: string;
  group?: string;
}

export interface Diagnostic {
  severity: "error" | "warning";
  file?: string;
  path?: string;
  message: string;
}

export interface ModelFile {
  file: string;
  views: ViewSummary[];
  errors: Diagnostic[];
}

export interface SiteData {
  version: 1;
  name: string;
  title: string;
  base: string;
  files: ModelFile[];
}

/** Loads the data file the build wrote beside the page, so it works at any base path. */
export async function loadSiteData(): Promise<SiteData> {
  const response = await fetch("./archidocs-data.json");
  if (!response.ok) throw new Error(`Could not load the model data (${response.status}).`);
  return (await response.json()) as SiteData;
}
