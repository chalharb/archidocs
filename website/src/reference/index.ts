/** Every generated reference page. */
import { cliPages } from "./cli.ts";
import { ciPages } from "./ci.ts";
import { mcpPages } from "./mcp.ts";
import { modelPages } from "./model.ts";
import type { GeneratedPage } from "./page.ts";
import { rulePages } from "./rules.ts";
import { agentGuidePages, changelogPage, glossaryPage } from "./text-sources.ts";

export type { GeneratedPage } from "./page.ts";

export async function generatedPages(): Promise<GeneratedPage[]> {
  return [...cliPages(), ...modelPages(), ...(await mcpPages()), ...ciPages(), ...(await rulePages()),...agentGuidePages(), glossaryPage(), changelogPage()];
}
