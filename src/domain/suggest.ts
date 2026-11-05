/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j]!;
      prev[j] = Math.min(above + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length]!;
}

/**
 * Closest candidate to `input` (case-insensitive), or undefined if none is close enough.
 * Ties resolve to the alphabetically first candidate, so results are deterministic.
 */
export function suggest(input: string, candidates: readonly string[]): string | undefined {
  const needle = input.toLowerCase();
  const threshold = Math.max(2, Math.floor(input.length / 3));
  let best: string | undefined;
  let bestScore = Infinity;
  for (const candidate of [...candidates].sort()) {
    const score = editDistance(needle, candidate.toLowerCase());
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore <= threshold ? best : undefined;
}
