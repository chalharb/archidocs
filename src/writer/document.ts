import { Document, isCollection, isMap, isSeq, parseDocument, type ToStringOptions } from "yaml";

type Path = readonly (string | number)[];

/**
 * One YAML file being edited. Edits go through the parsed document, which
 * keeps comments, key order, quoting and flow style; the file's own indent,
 * sequence indent and flow padding are detected so untouched lines come back
 * as they were.
 */
export class YamlFile {
  readonly #doc: Document;
  readonly #style: ToStringOptions;

  /** The text before any edit; null for a file that does not exist yet. */
  readonly original: string | null;

  constructor(original: string | null) {
    this.original = original;
    this.#doc = original === null ? new Document({}) : parseDocument(original);
    this.#style = detectStyle(original ?? "");
  }

  has(path: Path): boolean {
    return this.#doc.hasIn(path);
  }

  get(path: Path): unknown {
    const node = this.#doc.getIn(path, true);
    return isCollection(node) ? node.toJSON() : this.#doc.getIn(path);
  }

  /** Sets the value at `path`, creating any missing maps on the way; `flow` writes a collection inline. */
  set(path: Path, value: unknown, { flow = false } = {}): void {
    this.#doc.setIn(path, this.#doc.createNode(value, { flow }));
  }

  /** Appends to the sequence at `path`, creating it if missing. */
  append(path: Path, value: unknown): void {
    const seq = this.#doc.getIn(path, true);
    if (isSeq(seq)) seq.add(this.#doc.createNode(value));
    else this.set(path, [value]);
  }

  /** Deletes the value at `path`, then any collection it leaves empty on the way up. */
  delete(path: Path): void {
    this.#doc.deleteIn(path);
    for (let up = path.slice(0, -1); up.length > 0; up = up.slice(0, -1)) {
      const node = this.#doc.getIn(up, true);
      if ((isMap(node) || isSeq(node)) && node.items.length === 0) this.#doc.deleteIn(up);
      else break;
    }
  }

  toString(): string {
    const text = this.#doc.toString(this.#style);
    return text === "{}\n" ? "" : text;
  }
}

/** Matches a line that opens a block scalar (`key: |`, `- >-`, …), whose more-indented lines are text, not YAML. */
const BLOCK_SCALAR = /(^|[:-])\s*[|>][+-]?\d*[+-]?\s*(#.*)?$/;

/** The file's lines that are YAML structure: no blank lines, comments or block scalar text (such as a Markdown `description: |`). */
function structuralLines(text: string): string[] {
  const out: string[] = [];
  let blockAt = -1;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const own = line.length - line.trimStart().length;
    if (blockAt >= 0 && own > blockAt) continue;
    blockAt = -1;
    if (line.trim().startsWith("#")) continue;
    out.push(line);
    if (BLOCK_SCALAR.test(line)) blockAt = own;
  }
  return out;
}

function detectStyle(text: string): ToStringOptions {
  const lines = structuralLines(text);
  let indent = 2;
  let indentFound = false;
  let indentSeq = true;
  for (const [i, line] of lines.entries()) {
    const own = line.length - line.trimStart().length;
    const next = lines[i + 1];
    if (next === undefined || !/:\s*(#.*)?$/.test(line)) continue;
    const child = next.length - next.trimStart().length;
    if (next.trimStart().startsWith("- ")) {
      if (child === own) indentSeq = false;
    } else if (child > own && !indentFound) {
      indent = child - own;
      indentFound = true;
    }
  }
  return {
    indent,
    indentSeq,
    lineWidth: 0,
    flowCollectionPadding: /[[{] \S/.test(text),
  };
}
