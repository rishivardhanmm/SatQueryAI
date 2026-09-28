#!/usr/bin/env bash
# Network-tolerant resume loop for the large official LoveDA training archive.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
archive="$root/data/raw/loveda/Train.zip"
url='https://zenodo.org/api/records/5706578/files/Train.zip/content'
mkdir -p "$(dirname "$archive")"
while ! unzip -tq "$archive" >/dev/null 2>&1; do
  # End each connection after 55 seconds; the next iteration resumes by byte.
  curl -L --fail --continue-at - --max-time 55 "$url" -o "$archive" || true
  sleep 3
done
echo "$(date -Iseconds) Train.zip verified" >> "$root/ml/segmentation/artifacts/stage1-run.log"
