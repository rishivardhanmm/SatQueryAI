#!/usr/bin/env bash
# Rebuild a known-corrupted tail from the last verified contiguous prefix.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
archive="$root/data/raw/loveda/Train.zip"
url='https://zenodo.org/api/records/5706578/files/Train.zip/content'
total=4021669263
# This prefix was downloaded before concurrent retry writers were introduced.
verified_prefix=3842359632
chunk=4194304
tmp="${TMPDIR:-/tmp}/satquery-loveda-range"

truncate -s "$verified_prefix" "$archive"
while [ "$(stat -f %z "$archive")" -lt "$total" ]; do
  start="$(stat -f %z "$archive")"
  remaining=$((total-start)); size="$chunk"; [ "$remaining" -lt "$size" ] && size="$remaining"
  end=$((start+size-1))
  rm -f "$tmp"
  curl -L --fail --max-time 55 --range "$start-$end" -o "$tmp" "$url" || true
  [ -f "$tmp" ] && [ "$(stat -f %z "$tmp")" -eq "$size" ] || { sleep 3; continue; }
  cat "$tmp" >> "$archive"
done
unzip -tq "$archive" >/dev/null
echo "$(date -Iseconds) Train.zip rebuilt and verified" >> "$root/ml/segmentation/artifacts/stage1-run.log"
