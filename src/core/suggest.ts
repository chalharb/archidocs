/** The candidate closest to `input` by edit distance, if any is close enough. */
export function suggest(input: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Math.max(2, Math.floor(input.length / 3)) + 1;
  for (const candidate of candidates) {
    // A prefix like "storefront" for "storefront-team" counts as a near miss.
    const prefix = input.length >= 3 && (candidate.startsWith(input) || input.startsWith(candidate));
    const d = prefix ? Math.min(1, distance(input, candidate)) : distance(input, candidate);
    if (d < bestDistance || (d === bestDistance && best !== undefined && candidate < best)) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

export function didYouMean(input: string, candidates: Iterable<string>): string {
  const s = suggest(input, candidates);
  return s === undefined ? "" : `; did you mean "${s}"?`;
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}
