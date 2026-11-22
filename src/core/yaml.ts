import { isMap, isSeq, LineCounter, parseDocument, type Document, type Node } from "yaml";

export interface Position {
  line: number;
  column: number;
}

export interface ParsedYaml {
  /** The plain data, or undefined when the file could not be parsed. */
  data: unknown;
  syntaxError?: Position & { message: string };
  /** Where the node at a path starts; `key` asks for the map key rather than its value. */
  positionOf(path: readonly PropertyKey[], options?: { key?: boolean }): Position;
}

export function parseYaml(text: string): ParsedYaml {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: false, uniqueKeys: true });
  const toPosition = (offset: number): Position => {
    const { line, col } = lineCounter.linePos(offset);
    return { line, column: col };
  };
  const positionOf = (path: readonly PropertyKey[], options: { key?: boolean } = {}) =>
    toPosition(offsetOf(doc, path, options.key ?? false));

  const [error] = doc.errors;
  if (error) {
    const pos = toPosition(error.pos[0]);
    return { data: undefined, syntaxError: { ...pos, message: firstLine(error.message) }, positionOf };
  }
  return { data: doc.toJS() ?? {}, positionOf };
}

/**
 * Finds the deepest node along `path` and returns its start offset. If the
 * path runs out of nodes (a missing field), the last node found is used.
 */
function offsetOf(doc: Document, path: readonly PropertyKey[], wantKey: boolean): number {
  let node: Node | null | undefined = doc.contents as Node | null;
  let offset = node?.range?.[0] ?? 0;
  for (const [i, segment] of path.entries()) {
    const last = i === path.length - 1;
    if (isMap(node)) {
      const pair = node.items.find((p) => (p.key as { value?: unknown } | null)?.value === segment);
      if (!pair) return offset;
      const key = pair.key as Node;
      if (last && wantKey) return key.range?.[0] ?? offset;
      offset = key.range?.[0] ?? offset;
      node = pair.value as Node | null;
      if (node?.range && !(last && wantKey)) offset = node.range[0];
    } else if (isSeq(node) && typeof segment === "number") {
      node = node.items[segment] as Node | undefined;
      if (!node?.range) return offset;
      offset = node.range[0];
    } else {
      return offset;
    }
  }
  return offset;
}

function firstLine(message: string): string {
  return message.split("\n")[0]!.trim();
}
