#!/usr/bin/env bash
# Summarize requirement checklist progress.
# Counts top-level checklist items (no leading indentation) in docs/checklists/*.md,
# excluding struck-through (removed/deferred) items.
#
# Usage:
#   scripts/prd-progress.sh          print the progress table
#   scripts/prd-progress.sh --write  also replace the table in docs/checklists/README.md
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/docs/checklists"
readme="$dir/README.md"

table="$(
  printf '| Checklist | Done | Total | %% |\n|---|---:|---:|---:|\n'
  total_done=0
  total_all=0
  for f in "$dir"/[0-9]*.md; do
    name="$(basename "$f" .md)"
    # Top-level items only; skip struck-through ones.
    all=$(grep -E '^- \[[ xX]\] ' "$f" | grep -vc -- '- \[[ xX]\] ~~' || true)
    done_=$(grep -E '^- \[[xX]\] ' "$f" | grep -vc -- '- \[[xX]\] ~~' || true)
    pct=0
    [ "$all" -gt 0 ] && pct=$(( done_ * 100 / all ))
    printf '| [%s](%s.md) | %d | %d | %d%% |\n' "$name" "$name" "$done_" "$all" "$pct"
    total_done=$(( total_done + done_ ))
    total_all=$(( total_all + all ))
  done
  tpct=0
  [ "$total_all" -gt 0 ] && tpct=$(( total_done * 100 / total_all ))
  printf '| **Total** | **%d** | **%d** | **%d%%** |\n' "$total_done" "$total_all" "$tpct"
)"

echo "$table"

if [ "${1:-}" = "--write" ]; then
  tmp="$(mktemp)"
  tablefile="$(mktemp)"
  trap 'rm -f "$tmp" "$tablefile"' EXIT
  printf '%s\n' "$table" > "$tablefile"
  # Read the table from a file: BSD awk rejects newlines in -v values.
  awk -v tablefile="$tablefile" '
    /<!-- PROGRESS:START -->/ { print; while ((getline line < tablefile) > 0) print line; skip=1; next }
    /<!-- PROGRESS:END -->/   { skip=0 }
    !skip { print }
  ' "$readme" > "$tmp"
  mv "$tmp" "$readme"
  echo "Updated $readme"
fi
