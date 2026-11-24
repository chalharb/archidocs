/**
 * What the landing page shows, captured at build time from the Big Bank
 * example: the MCP server is started in-process over its checkout and asked
 * `get_impact(core:mainframe, upstream)` and `get_view` for the Saved View
 * that answers the same question with the Impact lens. The build fails if the
 * two answers stop agreeing, so the page can never claim they do when they
 * don't.
 */
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { checkoutSource, createServer } from "../../../src/mcp/index.ts";
import { teamStyles } from "../../../src/render/index.ts";
import type { ListedTool } from "../reference/mcp.ts";
import { diagramFile, exportDiagrams } from "./examples.ts";
import { repoPath } from "./repo.ts";

/** The question asked twice. */
export const QUESTION = {
  example: "big-bank",
  /** The Saved View the viewer answers with. */
  view: "digital:mainframe-outage",
  tool: "get_impact",
  arguments: { id: "core:mainframe", direction: "upstream" },
} as const;

export interface ImpactElement {
  id: string;
  kind: string;
  name: string;
  owner: string;
  relationships: { from: string; to: string; description: string | null; source: { file: string; line: number } | null }[];
}

export interface ImpactResult {
  id: string;
  direction: string;
  maxDepth: number | null;
  upstream: { total: number; truncated: boolean; rings: { distance: number; elements: ImpactElement[] }[] };
}

export interface YamlLine {
  /** 1-based line number in the file. */
  n: number;
  text: string;
  /** The line the Relationship is declared on. */
  mark: boolean;
}

export interface Landing {
  call: { name: string; arguments: Record<string, unknown> };
  /** The tool's structured result, exactly as the client received it. */
  impact: ImpactResult;
  /** The Element the question is about, e.g. "Mainframe". */
  subject: string;
  /** Team id → its name, and the code and stripe colour the diagrams draw it with. */
  teams: Map<string, { name: string; code: string; color: string }>;
  view: {
    id: string;
    title: string;
    /** The viewer's breadcrumb for a Saved View: "Saved", the Project's name, then the title. */
    crumbs: string[];
    /** The lens chip as the viewer words it: "Impact of Mainframe, upstream". */
    lens: string;
    /** How many nodes the lens marks upstream. */
    hits: number;
  };
  /** Every tool the server lists. */
  tools: ListedTool[];
  /** The YAML behind one Relationship in the result, with its enclosing keys. */
  yaml: { file: string; element: string; description: string; lines: YamlLine[] };
}

let captured: Promise<Landing> | undefined;

/** Runs the capture once per build. */
export function captureLanding(): Promise<Landing> {
  captured ??= capture();
  return captured;
}

async function capture(): Promise<Landing> {
  const source = checkoutSource({ root: repoPath(`examples/${QUESTION.example}/archidocs`) });
  const server = createServer({ source });
  const client = new Client({ name: "archidocs-docs", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(`The landing page's ${name} call failed: ${JSON.stringify(result.structuredContent ?? result.content)}`);
      return result.structuredContent as T;
    };
    const impact = await call<ImpactResult>(QUESTION.tool, QUESTION.arguments);
    const view = await call<{ id: string; title: string; nodes: { id: string; mark?: { hit?: boolean; side?: string } }[]; lens: { impact?: string; direction?: string } | null }>("get_view", { id: QUESTION.view });
    const tools = (await client.listTools()).tools as ListedTool[];

    if (impact.upstream.truncated) throw new Error(`${QUESTION.tool} truncated its result; the landing page needs all of it.`);
    const agent = new Set(impact.upstream.rings.flatMap((r) => r.elements.map((e) => e.id)));
    const viewer = new Set(view.nodes.filter((n) => n.mark?.hit && n.mark.side === "upstream").map((n) => n.id));
    const differ = [...agent].filter((id) => !viewer.has(id)).concat([...viewer].filter((id) => !agent.has(id)));
    if (differ.length > 0 || view.lens?.impact !== QUESTION.arguments.id || view.lens.direction !== QUESTION.arguments.direction) {
      throw new Error(`The landing page says the agent and the viewer agree, but ${QUESTION.view} and ${QUESTION.tool} differ on: ${differ.join(", ") || "the lens"}.`);
    }

    const { bundle } = await source.snapshot();
    const styles = teamStyles(bundle);
    const project = QUESTION.view.split(":")[0]!;
    const projectName = bundle.projects.find((p) => p.id === project)?.name ?? project;
    const subject = bundle.elements.find((e) => e.id === QUESTION.arguments.id)?.name ?? QUESTION.arguments.id;

    return {
      call: { name: QUESTION.tool, arguments: { ...QUESTION.arguments } },
      impact,
      subject,
      teams: new Map(bundle.teams.map((t) => [t.id, { name: t.name, ...styles.get(t.id)! }])),
      view: {
        id: view.id,
        title: view.title,
        crumbs: ["Saved", projectName, view.title],
        lens: `Impact of ${subject}, ${QUESTION.arguments.direction}`,
        hits: viewer.size,
      },
      tools,
      yaml: await yamlBehind(impact),
    };
  } finally {
    await client.close();
  }
}

/**
 * The YAML that puts the first directly affected Element in both answers: its
 * block in its Project file, led by the keys it sits under.
 */
async function yamlBehind(impact: ImpactResult): Promise<Landing["yaml"]> {
  const first = impact.upstream.rings[0]?.elements.find((e) => e.kind === "service" && e.relationships[0]?.from === e.id && e.relationships[0].source);
  const source = first?.relationships[0]?.source;
  if (!first || !source) throw new Error("No directly affected Service declares its own Relationship to show on the landing page.");
  const all = (await readFile(repoPath(source.file), "utf8")).split("\n");
  const indent = (line: string) => line.length - line.trimStart().length;
  const key = first.id.split(":")[1]!;
  const start = all.findLastIndex((line, i) => i < source.line && line.trim() === `${key}:`);
  if (start < 0) throw new Error(`Couldn't find ${key}: above line ${source.line} of ${source.file}.`);
  let end = start + 1;
  while (end < all.length && (all[end]!.trim() === "" || indent(all[end]!) > indent(all[start]!))) end++;
  while (all[end - 1]!.trim() === "") end--;
  const parents: number[] = [];
  for (let i = start - 1, depth = indent(all[start]!); i >= 0 && depth > 0; i--) {
    if (all[i]!.trim() !== "" && indent(all[i]!) < depth) {
      parents.unshift(i);
      depth = indent(all[i]!);
    }
  }
  const line = (i: number): YamlLine => ({ n: i + 1, text: all[i]!, mark: i + 1 === source.line });
  return {
    file: source.file.replace(/^examples\/[^/]+\/archidocs\//, ""),
    element: first.name,
    description: first.relationships[0]!.description ?? "depends on",
    lines: [...parents.map(line), ...Array.from({ length: end - start }, (_, k) => line(start + k))],
  };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** A count in words up to twelve, then in figures. */
export const countWord = (n: number): string => WORDS[n] ?? String(n);

export interface CroppedDiagram {
  svg: string;
  width: number;
  height: number;
  /** Where the direct ring nearest the origin starts, in the cropped picture's pixels. */
  ringX: number;
}

/**
 * The light export of the Saved View, cropped to its nodes and edges: the
 * export's own title and legend repeat what the viewer pane's plate and lens
 * strip already say. The crop comes from the export's own geometry: every
 * point of every path and rect in its content group.
 */
export function cropDiagram(svg: string, margin = 12): CroppedDiagram {
  const groups = [...svg.matchAll(/<g transform="translate\(([\d.-]+),([\d.-]+)\)">/g)];
  const [content, legend] = groups;
  if (!content || !legend) throw new Error("The export has no content and legend groups to crop to.");
  const body = svg.slice(content.index, legend.index);
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => (xs.push(x), ys.push(y));
  for (const [, d] of body.matchAll(/ d="([^"]+)"/g)) {
    for (const [, cmd, args] of d!.matchAll(/([MLA])([^MLAZz]+)/g)) {
      const n = args!.split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === "A") add(n[5]!, n[6]!);
      else for (let i = 0; i + 1 < n.length; i += 2) add(n[i]!, n[i + 1]!);
    }
  }
  for (const [, attrs] of body.matchAll(/<rect ([^>]+)>/g)) {
    const num = (name: string) => Number(new RegExp(`\\b${name}="([\\d.-]+)"`).exec(attrs!)?.[1] ?? 0);
    add(num("x"), num("y"));
    add(num("x") + num("width"), num("y") + num("height"));
  }
  const [dx, dy] = [Number(content[1]), Number(content[2])];
  const x = Math.floor(Math.min(...xs) + dx - margin);
  const y = Math.floor(Math.min(...ys) + dy - margin);
  const width = Math.ceil(Math.max(...xs) + dx + margin) - x;
  const height = Math.ceil(Math.max(...ys) + dy + margin) - y;
  // The left edge (its Team stripe) of the node nearest the origin among those the lens marks one hop upstream.
  const ring = [...body.matchAll(/<g>(.*?)<\/g>/gs)].filter(([g]) => g.includes(">UPSTREAM 1<")).map(([g]) => Math.min(...[...g.matchAll(/<rect x="([\d.-]+)"/g)].map((m) => Number(m[1]))));
  const ringX = Math.max(...ring) + dx - x;
  // The title and label above the content group fall partly inside the margin; drop them.
  const head = svg.slice(0, content.index).replace(/<text\b[^>]*>[^<]*<\/text>\n?/g, "");
  const cropped = (head + svg.slice(content.index)).replace(/^<svg([^>]*?) width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/, `<svg$1 width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"`);
  if (!cropped.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}"`)) throw new Error("Couldn't set the cropped viewBox on the export.");
  return { svg: cropped, width, height, ringX };
}

/** Where the page serves the cropped map. */
export const LANDING_MAP_URL = "/landing/map.svg";

/** The light export of the question's Saved View, cropped for the viewer pane. */
export async function landingDiagram(): Promise<CroppedDiagram> {
  const key = `${QUESTION.example}/light/${diagramFile(QUESTION.view)}`;
  const svg = (await exportDiagrams()).get(key);
  if (!svg) throw new Error(`The build exported no diagram ${key} for the landing page.`);
  return cropDiagram(svg);
}
