/**
 * A unified diff of one file, with three lines of context, in the form
 * `git diff` and `patch` read. `before` is null for a new file. Returns ""
 * when nothing changed.
 */
export function unifiedDiff(path: string, before: string | null, after: string): string {
  if (before === after) return "";
  const a = lines(before ?? "");
  const b = lines(after);
  const ops = diffLines(a, b);
  const header = [`--- ${before === null ? "/dev/null" : `a/${path}`}`, `+++ b/${path}`];
  return [...header, ...hunks(ops, 3)].join("\n") + "\n";
}

type Op = { type: " " | "-" | "+"; text: string };

function lines(text: string): string[] {
  if (text === "") return [];
  const all = text.split("\n");
  if (all[all.length - 1] === "") all.pop();
  return all;
}

/** A shortest edit script by longest common subsequence; deletions come before insertions within a change. */
function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // lcs[i][j]: length of the LCS of a[i..] and b[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ type: " ", text: a[i]! });
      i++;
      j++;
    } else if (j >= m || (i < n && lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      ops.push({ type: "-", text: a[i]! });
      i++;
    } else {
      ops.push({ type: "+", text: b[j]! });
      j++;
    }
  }
  return ops;
}

function hunks(ops: Op[], context: number): string[] {
  const out: string[] = [];
  const changed = ops.map((op, k) => (op.type === " " ? -1 : k)).filter((k) => k >= 0);
  let k = 0;
  while (k < changed.length) {
    // Grow the hunk while the next change is within two contexts of the last.
    let last = changed[k]!;
    let next = k + 1;
    while (next < changed.length && changed[next]! - last <= 2 * context) last = changed[next++]!;
    const start = Math.max(0, changed[k]! - context);
    const end = Math.min(ops.length, last + context + 1);
    const before = ops.slice(0, start);
    const oldStart = before.filter((o) => o.type !== "+").length;
    const newStart = before.filter((o) => o.type !== "-").length;
    const body = ops.slice(start, end);
    const oldLen = body.filter((o) => o.type !== "+").length;
    const newLen = body.filter((o) => o.type !== "-").length;
    out.push(`@@ -${range(oldStart, oldLen)} +${range(newStart, newLen)} @@`, ...body.map((o) => o.type + o.text));
    k = next;
  }
  return out;
}

const range = (start: number, len: number) => (len === 1 ? `${start + 1}` : `${len === 0 ? start : start + 1},${len}`);
