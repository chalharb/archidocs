import type { ReactNode } from "react";

/**
 * Renders an ADR body's markdown as React elements, never as HTML strings, so
 * nothing in a body can run script. Covers what MADR files use: ATX headings,
 * paragraphs, bullet and numbered lists, block quotes, fenced code, rules,
 * and inline code, emphasis, strong and links. Headings shift down by
 * `shift` levels so they nest under the reader's own title.
 */
export function Markdown({ source, shift = 0 }: { source: string; shift?: number }) {
  return <>{blocks(source.replace(/\r\n?/g, "\n").split("\n"), shift)}</>;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^(`{3,}|~{3,})\s*(\S*)/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

function blocks(lines: string[], shift: number): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  const key = () => out.length;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i]!.startsWith(fence[1]!); i++) body.push(lines[i]!);
      i++;
      out.push(
        <pre key={key()}>
          <code data-language={fence[2] || undefined}>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const Tag = `h${Math.min(6, heading[1]!.length + shift)}` as "h1";
      out.push(<Tag key={key()}>{inline(heading[2]!)}</Tag>);
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push(<hr key={key()} />);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]!); i++) body.push(QUOTE.exec(lines[i]!)![1]!);
      out.push(<blockquote key={key()}>{blocks(body, shift)}</blockquote>);
      continue;
    }
    const list = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (list) {
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const l = lines[i]!;
        const item = list.exec(l);
        if (item) items.push(item[1]!);
        else if (l.trim() !== "" && /^\s+\S/.test(l) && items.length > 0) items[items.length - 1] += ` ${l.trim()}`;
        else break;
      }
      const Tag = list === BULLET ? "ul" : "ol";
      out.push(
        <Tag key={key()}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length; i++) {
      const l = lines[i]!;
      if (l.trim() === "" || FENCE.test(l) || HEADING.test(l) || BULLET.test(l) || NUMBERED.test(l) || QUOTE.test(l) || RULE.test(l)) break;
      para.push(l.trim());
    }
    out.push(<p key={key()}>{inline(para.join(" "))}</p>);
  }
  return out;
}

/** Inline spans, earliest match first: code, links, autolinks, strong, then emphasis. */
const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^>\s]+)>|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s][^*]*?)\*|\b_([^_\s][^_]*?)_\b/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = out.length;
    const [, code, label, href, auto, strong1, strong2, em1, em2] = m;
    if (code !== undefined) out.push(<code key={k}>{code}</code>);
    else if (label !== undefined) out.push(<Link key={k} href={href!}>{inline(label)}</Link>);
    else if (auto !== undefined) out.push(<Link key={k} href={auto}>{auto}</Link>);
    else if (strong1 !== undefined || strong2 !== undefined) out.push(<strong key={k}>{inline((strong1 ?? strong2)!)}</strong>);
    else out.push(<em key={k}>{inline((em1 ?? em2)!)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A link out of the viewer; anything but http(s), mailto or a relative path is shown as text. */
function Link({ href, children }: { href: string; children: ReactNode }) {
  if (!/^(https?:|mailto:|[./#]|[^:]*$)/i.test(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
