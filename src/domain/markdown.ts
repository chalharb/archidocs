/**
 * Markdown analysis for documents and decisions (DOC-04, ADR-02, ADD-009).
 *
 * Parses a body once with the same remark + GFM pipeline used for rendering,
 * so a link inside a code block is never mistaken for a model link. Pure.
 */
import type { Heading, Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { MarkdownBody } from "./resources";

export const MODEL_LINK_KINDS = ["entity", "diagram", "decision", "document"] as const;
export type ModelLinkKind = (typeof MODEL_LINK_KINDS)[number];

/** A link from a document body to the model, or to another workspace Markdown file. */
export interface DocLink {
  kind: ModelLinkKind | "file";
  /** Model ID, or for `file` the workspace-relative path (null if it escapes the workspace). */
  target: string | null;
  /** The URL as written. */
  url: string;
  /** 1-based position in the file. */
  line: number;
  column: number;
}

export interface DocHeading {
  depth: number;
  text: string;
  line: number;
}

export interface MarkdownAnalysis {
  links: DocLink[];
  headings: DocHeading[];
}

const MODEL_LINK = /^(entity|diagram|decision|document):(.*)$/;
const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;

const parser = unified().use(remarkParse).use(remarkGfm);

/** Resolve `rel` against the directory of `from`; null if it leaves the workspace. */
export function resolveRelativePath(from: string, rel: string): string | null {
  const parts = from.split("/").slice(0, -1);
  for (const segment of rel.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Classify a link URL; undefined for links that aren't model or Markdown-file links. */
export function classifyUrl(
  url: string,
  file: string,
): Pick<DocLink, "kind" | "target"> | undefined {
  const model = MODEL_LINK.exec(url);
  if (model) return { kind: model[1] as ModelLinkKind, target: safeDecode(model[2]!) };
  if (EXTERNAL.test(url) || url.startsWith("#") || url.startsWith("/")) return undefined;
  const path = safeDecode(url.split(/[?#]/)[0]!);
  if (!/\.md$/i.test(path)) return undefined;
  return { kind: "file", target: resolveRelativePath(file, path) };
}

function textOf(node: Heading): string {
  let text = "";
  visit(node, (n) => {
    if (n.type === "text" || n.type === "inlineCode") text += n.value;
  });
  return text.trim();
}

/** Extract model links and headings, with positions relative to the file. */
export function analyzeMarkdown(body: MarkdownBody, file: string): MarkdownAnalysis {
  const tree = parser.parse(body.text) as Root;
  const offset = body.line - 1;
  const links: DocLink[] = [];
  const headings: DocHeading[] = [];
  visit(tree, (node) => {
    const start = node.position?.start;
    /* v8 ignore next -- remark always sets positions when parsing */
    if (!start) return;
    const line = start.line + offset;
    if (node.type === "link" || node.type === "definition") {
      const classified = classifyUrl(node.url, file);
      if (classified) links.push({ ...classified, url: node.url, line, column: start.column });
    } else if (node.type === "heading") {
      headings.push({ depth: node.depth, text: textOf(node), line });
    }
  });
  return { links, headings };
}
