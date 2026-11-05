import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LinkTarget } from "@/server/workspace/documentation-views";
import { Markdown } from "./markdown";

const html = (markdown: string, links: Record<string, LinkTarget | null> = {}) =>
  renderToStaticMarkup(<Markdown markdown={markdown} workspace="ws" links={links} />);

/** Known XSS payloads (SEC-11). None may produce script, handlers or unsafe URLs. */
const XSS = [
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  "<svg onload=alert(1)><circle/></svg>",
  '<iframe src="https://evil.example"></iframe>',
  '<a href="javascript:alert(1)">x</a>',
  "<details open ontoggle=alert(1)>x</details>",
  '<div style="background:url(javascript:alert(1))">x</div>',
  "<object data=x></object><embed src=x>",
  '<form action="javascript:alert(1)"><button>x</button></form>',
  "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
  "[x](javascript:alert(1))",
  "[x](JaVaScRiPt:alert(1))",
  "[x](  javascript:alert(1))",
  "[x](java&#x09;script:alert(1))",
  "[x](&#106;avascript:alert(1))",
  "[x](vbscript:msgbox(1))",
  "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
  "[x](file:///etc/passwd)",
  "<javascript:alert(1)>",
  "![x](javascript:alert(1))",
  "![x](data:image/svg+xml,<svg onload=alert(1)>)",
  "[x]: javascript:alert(1)\n\n[link][x]",
  '[x](https://example.com "title" onmouseover=alert(1))',
];

describe("SEC-11 safe Markdown rendering", () => {
  it.each(XSS)("neutralises %s", (payload) => {
    const root = document.createElement("div");
    root.innerHTML = html(payload);
    const unsafeTags = "script,iframe,object,embed,form,svg,math,style,img,details,button";
    expect(root.querySelectorAll(unsafeTags)).toHaveLength(0);
    for (const el of root.querySelectorAll("*")) {
      for (const attr of el.attributes) {
        expect(attr.name, el.outerHTML).not.toMatch(/^on|^style$/i);
        if (["href", "src", "action"].includes(attr.name))
          expect(attr.value.trim(), el.outerHTML).not.toMatch(/^(javascript|vbscript|data|file):/i);
      }
    }
  });

  it("renders ordinary Markdown and GFM", () => {
    const out = html(
      "# Title\n\nSome *em* and `code`.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n~~gone~~\n\n```ts\nconst x = 1;\n```\n",
    );
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<em>em</em>");
    expect(out).toContain("<table>");
    expect(out).toContain('type="checkbox"');
    expect(out).toContain("<del>gone</del>");
    expect(out).toContain('<code class="language-ts">const x = 1;\n</code>');
  });

  it("shifts headings so the top level is h2, without skipping levels", () => {
    expect(html("# A\n\n## B\n\n###### F")).toBe(
      '<div class="markdown"><h2>A</h2>\n<h3>B</h3>\n<h6>F</h6></div>',
    );
    expect(html("## Context\n\n### Detail")).toBe(
      '<div class="markdown"><h2>Context</h2>\n<h3>Detail</h3></div>',
    );
    expect(html("### Deep\n\n#### Deeper")).toBe(
      '<div class="markdown"><h2>Deep</h2>\n<h3>Deeper</h3></div>',
    );
  });

  it("drops raw HTML rather than rendering it", () => {
    expect(html("before <b>bold</b> after")).toBe(
      '<div class="markdown"><p>before bold after</p></div>',
    );
  });

  it("opens external links in a new tab without an opener", () => {
    expect(html("[site](https://example.com/a)")).toContain(
      '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">site</a>',
    );
    expect(html("[mail](mailto:a@example.com)")).toContain(
      '<a href="mailto:a@example.com">mail</a>',
    );
  });

  it("never loads remote images: they render as links; local ones as placeholders", () => {
    expect(html("![logo](https://example.com/logo.png)")).toContain(
      '<a href="https://example.com/logo.png" target="_blank" rel="noopener noreferrer">logo</a>',
    );
    expect(html("![diagram](img/d.png)")).toContain(
      '<span class="image-placeholder" title="img/d.png">[image: diagram]</span>',
    );
    expect(html("![](img/d.png)")).toContain(">[image]</span>");
  });
});

describe("DOC-04 model links", () => {
  const links: Record<string, LinkTarget | null> = {
    "entity:api": { kind: "entity", id: "api", title: "API", diagram: "containers" },
    "entity:lonely": { kind: "entity", id: "lonely", title: "Lonely" },
    "diagram:containers": { kind: "diagram", id: "containers", title: "Containers" },
    "decision:adr-1": { kind: "decision", id: "adr-1", title: "ADR 1" },
    "my notes.md": { kind: "document", id: "notes", title: "Notes" },
    "entity:nope": null,
  };

  it("rewrites resolved links to app pages", () => {
    const out = html(
      "[a](entity:api) [b](entity:lonely) [c](diagram:containers) [d](decision:adr-1) [e](<my notes.md>)",
      links,
    );
    expect(out).toContain(
      '<a href="/workspaces/ws/diagrams/containers?focus=api" data-link-kind="entity">a</a>',
    );
    expect(out).toContain('<a href="/workspaces/ws/entities/lonely" data-link-kind="entity">b</a>');
    expect(out).toContain(
      '<a href="/workspaces/ws/diagrams/containers" data-link-kind="diagram">c</a>',
    );
    expect(out).toContain(
      '<a href="/workspaces/ws/decisions/adr-1" data-link-kind="decision">d</a>',
    );
    expect(out).toContain('<a href="/workspaces/ws/docs/notes" data-link-kind="document">e</a>');
  });

  it("renders broken links as marked plain text", () => {
    expect(html("See [the API](entity:nope).", links)).toContain(
      '<span class="broken-link" title="Broken link: entity:nope" data-broken-link="entity:nope">the API</span>',
    );
  });

  it("leaves unknown model links that weren't analysed as plain sanitised links", () => {
    expect(html("[x](diagram:other)", links)).toContain('<a href="diagram:other">x</a>');
  });
});
