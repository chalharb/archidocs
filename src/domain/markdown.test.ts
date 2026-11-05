import { describe, expect, it } from "vitest";
import { analyzeMarkdown, classifyUrl, resolveRelativePath } from "./markdown";

const analyze = (text: string, line = 1, file = "docs/a.md") =>
  analyzeMarkdown({ text, line }, file);

describe("TEST-08 Markdown analysis (DOC-04, ADR-02)", () => {
  it("extracts model links with file positions", () => {
    const { links } = analyze(
      "Intro\n\nUses [API](entity:payments-api) and [d](diagram:containers).\n\n- [x](decision:adr-1) [y](document:guide)\n",
      10,
    );
    expect(links).toEqual([
      { kind: "entity", target: "payments-api", url: "entity:payments-api", line: 12, column: 6 },
      { kind: "diagram", target: "containers", url: "diagram:containers", line: 12, column: 37 },
      { kind: "decision", target: "adr-1", url: "decision:adr-1", line: 14, column: 3 },
      { kind: "document", target: "guide", url: "document:guide", line: 14, column: 23 },
    ]);
  });

  it("includes reference-style definitions and relative Markdown links", () => {
    const { links } = analyze(
      "[API][api] and [guide](../guide.md#setup)\n\n[api]: entity:payments-api\n",
    );
    expect(links.map((l) => [l.kind, l.target])).toEqual([
      ["file", "guide.md"],
      ["entity", "payments-api"],
    ]);
  });

  it("ignores external links, anchors, absolute paths, non-Markdown files and code", () => {
    const { links } = analyze(
      [
        "[a](https://example.com/x.md) [b](mailto:a@b.c) [c](#top) [d](/abs.md) [e](img.png)",
        "",
        "`[f](entity:inline-code)`",
        "",
        "```",
        "[g](entity:fenced)",
        "```",
      ].join("\n"),
    );
    expect(links).toEqual([]);
  });

  it("extracts heading text and depth, including inline code", () => {
    const { headings } = analyze("# Title\n\n## Context\n\ntext\n\n### Use `PostgreSQL`\n", 5);
    expect(headings).toEqual([
      { depth: 1, text: "Title", line: 5 },
      { depth: 2, text: "Context", line: 7 },
      { depth: 3, text: "Use PostgreSQL", line: 11 },
    ]);
  });

  it("decodes percent-encoded targets and tolerates malformed encoding", () => {
    expect(classifyUrl("entity:a%2Db", "x.md")).toEqual({ kind: "entity", target: "a-b" });
    expect(classifyUrl("entity:%E0%A4%A", "x.md")).toEqual({ kind: "entity", target: "%E0%A4%A" });
    expect(classifyUrl("my%20notes.md?x=1", "docs/a.md")).toEqual({
      kind: "file",
      target: "docs/my notes.md",
    });
  });

  it("resolves relative paths and refuses to leave the workspace", () => {
    expect(resolveRelativePath("docs/a.md", "./b.md")).toBe("docs/b.md");
    expect(resolveRelativePath("docs/a.md", "../decisions//c.md")).toBe("decisions/c.md");
    expect(resolveRelativePath("a.md", "../b.md")).toBeNull();
    expect(classifyUrl("../../x.md", "docs/a.md")).toEqual({ kind: "file", target: null });
  });
});
