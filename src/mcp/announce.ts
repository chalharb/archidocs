import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Source } from "./source.ts";

/** Where the server's log lines go: stderr, which every MCP client shows in its MCP log. */
export type Log = (line: string) => void;

/** The source as the log names it: `Workspace <root>` or `Bundle <location>`. */
export const describeSource = (source: Source): string => (source.kind === "checkout" ? `Workspace ${source.root}` : `Bundle ${source.location}`);

export interface StartupOptions {
  version: string;
  transport: "stdio" | "http" | "check";
  source: Source;
  writesAllowed: boolean;
}

/**
 * The line the server prints once it has loaded its source: what it serves,
 * how big the Model is and what check finds, or why it can't load it. It
 * never rejects: a source that fails to load is reported, not fatal, and the
 * tools return `source_unavailable` until it loads.
 */
export async function startupLine({ version, transport, source, writesAllowed }: StartupOptions): Promise<string> {
  const head = `archidocs ${version} MCP server (${transport}): ${describeSource(source)}`;
  try {
    const { bundle, issues } = await source.snapshot();
    const errors = issues.filter((i) => i.severity === "error").length;
    return `${head} — ${bundle.projects.length} Projects, ${bundle.elements.length} Elements; check: ${errors} errors, ${issues.length - errors} warnings; writes ${writesAllowed ? "on" : "off"}`;
  } catch (error) {
    return `${head} — can't load it: ${error instanceof Error ? error.message : String(error)}; tools return source_unavailable until it loads`;
  }
}

/**
 * One log line for a tool call: the tool, what it was called on, and how it
 * ended. A write names what it did and the files it changed; a refusal or a
 * failed read names its error code.
 */
export function callLine(name: string, args: unknown, result: CallToolResult): string {
  const target = label(args);
  const data = (result.structuredContent ?? {}) as { code?: string; action?: string; files?: string[]; dryRun?: boolean };
  let outcome: string;
  if (result.isError) outcome = `refused (${data.code ?? "error"})`;
  else if (data.action !== undefined) outcome = [data.action, ...(data.files ?? [])].join(" ") + (data.dryRun ? " (dry run)" : "");
  else outcome = "ok";
  return `${name}${target ? ` ${target}` : ""}: ${outcome}`;
}

/** What a call is about, from its arguments: an Element or other id (qualified by `project`), a Relationship's ends, or a Deployment. */
function label(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const a = args as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
  const qualify = (id: string) => (id.includes(":") || str("project") === undefined ? id : `${str("project")}:${id}`);
  const id = str("id");
  if (id !== undefined) return qualify(id);
  const [from, to] = [str("from"), str("to")];
  if (from !== undefined && to !== undefined) return `${qualify(from)} -> ${to}`;
  const [service, environment] = [str("service"), str("environment")];
  if (service !== undefined && environment !== undefined) return `${qualify(service)} in ${environment}`;
  return str("project") ?? str("topic") ?? "";
}
