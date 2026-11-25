/** Every generated reference page. */
import { cliPages } from "./cli.ts";
import { ciPages } from "./ci.ts";
import { captureTools, mcpPages } from "./mcp.ts";
import { modelPages } from "./model.ts";
import type { GeneratedPage } from "./page.ts";
import { rulePages } from "./rules.ts";
import { viewerUrlPages } from "./viewer-urls.ts";
import { agentGuidePages, changelogPage, glossaryPage } from "./text-sources.ts";

export type { GeneratedPage } from "./page.ts";

export async function generatedPages(): Promise<GeneratedPage[]> {
  return [...cliPages(), ...modelPages(), ...mcpPages(await captureTools()), ...ciPages(), ...(await rulePages()), ...viewerUrlPages(), ...agentGuidePages(), glossaryPage(), changelogPage()];
}
