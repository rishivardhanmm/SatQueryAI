#!/usr/bin/env bash
# Clean, range-verified LoveDA Train.zip download. Never overwrites an archive
# until the new file has passed a full ZIP integrity test.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
raw="$root/data/raw/loveda"
target="$raw/Train.clean.zip"
final="$raw/Train.zip"
url='https://zenodo.org/api/records/5706578/files/Train.zip/content'
total=4021669263
chunk=4194304
tmp="${TMPDIR:-/tmp}/satquery-loveda-clean-range"
mkdir -p "$raw"
touch "$target"

while [ "$(stat -f %z "$target")" -lt "$total" ]; do
  start="$(stat -f %z "$target")"
  remaining=$((total-start)); size="$chunk"; [ "$remaining" -lt "$size" ] && size="$remaining"
  end=$((start+size-1))
  rm -f "$tmp"
  curl -L --fail --max-time 55 --range "$start-$end" -o "$tmp" "$url" || true
  [ -f "$tmp" ] && [ "$(stat -f %z "$tmp")" -eq "$size" ] || { sleep 3; continue; }
  cat "$tmp" >> "$target"
  printf '%s %s/%s bytes\n' "$(date -Iseconds)" "$(stat -f %z "$target")" "$total"
done
unzip -tq "$target" >/dev/null
mv "$final" "$raw/Train.corrupt.zip" 2>/dev/null || true
mv "$target" "$final"
echo "$(date -Iseconds) Clean Train.zip verified" >> "$root/ml/segmentation/artifacts/stage1-run.log"
