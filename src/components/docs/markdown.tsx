/**
 * Safe Markdown rendering for documents and decisions (SEC-11, DOC-04, ADD-009).
 *
 * Runs on the server and produces React elements, never an HTML string:
 * - raw HTML in the Markdown is dropped (remark-rehype without allowDangerousHtml);
 * - rehype-sanitize then removes anything outside a conservative allow-list,
 *   including every URL scheme except http, https, mailto and the model schemes;
 * - model links are rewritten to app URLs, broken ones become marked plain text;
 * - nothing is loaded from remote origins: remote images render as links;
 * - headings shift so the body's top level is <h2>: the page title stays the only <h1>
 *   and no heading level is skipped.
 */
import type { Element, ElementContent, Root as HastRoot } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { MODEL_LINK_KINDS } from "@/domain/markdown";
import type { LinkTarget } from "@/server/workspace/documentation-views";
import { linkTargetHref } from "./links";

const SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", ...MODEL_LINK_KINDS],
    src: ["http", "https"],
  },
};

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, SCHEMA);

const REMOTE = /^(https?:)?\/\//i;

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function text(value: string): ElementContent {
  return { type: "text", value };
}

/** Rewrite links and images after sanitising. Only adds attributes we generate. */
function rewrite(tree: HastRoot, workspace: string, links: Record<string, LinkTarget | null>) {
  // remark-rehype percent-encodes URLs, so match on the decoded form.
  const byUrl = new Map(Object.entries(links).map(([url, target]) => [decode(url), target]));
  const HEADING = /^h([1-6])$/;
  let top = 7;
  visit(tree, "element", (node: Element) => {
    const level = HEADING.exec(node.tagName);
    if (level) top = Math.min(top, Number(level[1]));
  });
  visit(tree, "element", (node: Element, index, parent) => {
    const level = HEADING.exec(node.tagName);
    if (level) node.tagName = `h${Math.min(6, Number(level[1]) - top + 2)}`;
    if (node.tagName === "a") {
      const href = typeof node.properties.href === "string" ? node.properties.href : undefined;
      if (href === undefined) return;
      const key = decode(href);
      if (byUrl.has(key)) {
        const target = byUrl.get(key);
        if (target) {
          node.properties = { href: linkTargetHref(workspace, target), dataLinkKind: target.kind };
        } else {
          node.tagName = "span";
          node.properties = {
            className: ["broken-link"],
            title: `Broken link: ${href}`,
            dataBrokenLink: href,
          };
        }
      } else if (REMOTE.test(href)) {
        node.properties = { ...node.properties, target: "_blank", rel: ["noopener", "noreferrer"] };
      }
      return;
    }
    if (node.tagName === "img" && parent && index !== undefined) {
      const src = typeof node.properties.src === "string" ? node.properties.src : "";
      const alt = typeof node.properties.alt === "string" ? node.properties.alt : "";
      // Remote images are never fetched (SEC-11); they render as links.
      const replacement: Element = REMOTE.test(src)
        ? {
            type: "element",
            tagName: "a",
            properties: { href: src, target: "_blank", rel: ["noopener", "noreferrer"] },
            children: [text(alt || src)],
          }
        : {
            type: "element",
            tagName: "span",
            properties: { className: ["image-placeholder"], title: src },
            children: [text(alt ? `[image: ${alt}]` : "[image]")],
          };
      parent.children[index] = replacement;
    }
  });
}

export function renderMarkdown(
  markdown: string,
  workspace: string,
  links: Record<string, LinkTarget | null>,
): ReactNode {
  const tree = pipeline.runSync(pipeline.parse(markdown)) as HastRoot;
  rewrite(tree, workspace, links);
  return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}

export function Markdown({
  markdown,
  workspace,
  links,
}: {
  markdown: string;
  workspace: string;
  links: Record<string, LinkTarget | null>;
}) {
  return <div className="markdown">{renderMarkdown(markdown, workspace, links)}</div>;
}
