#!/usr/bin/env bash
# Continue Stage 1 without mistaking a partial archive for a usable dataset.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
raw="$root/data/raw/loveda"
log="$root/ml/segmentation/artifacts/stage1-run.log"
mkdir -p "$raw" "$root/ml/segmentation/artifacts"

complete_zip() {
  local archive="$1"
  [[ -f "$archive" ]] && unzip -tq "$archive" >/dev/null 2>&1
}

echo "$(date -Iseconds) Waiting for verified LoveDA training archive" >> "$log"
until complete_zip "$raw/Train.zip"; do sleep 60; done

echo "$(date -Iseconds) Training archive verified; downloading validation archive" >> "$log"
curl -L --fail --continue-at - https://zenodo.org/api/records/5706578/files/Val.zip/content -o "$raw/Val.zip"

echo "$(date -Iseconds) Waiting for verified LoveDA validation archive" >> "$log"
until complete_zip "$raw/Val.zip"; do sleep 60; done

echo "$(date -Iseconds) Both archives verified; extracting" >> "$log"
"$root/.venv-water/bin/python" "$root/ml/segmentation/prepare_loveda.py" >> "$log" 2>&1

echo "$(date -Iseconds) Auditing image/mask pairs" >> "$log"
cd "$root"
"$root/.venv-water/bin/python" - <<'PY' >> "$log" 2>&1
from pathlib import Path
root = Path('data/processed/loveda')
for split in ('Train', 'Val'):
    images = list((root / split).rglob('images_png/*.png'))
    masks = [p.parent.parent / 'masks_png' / p.name for p in images]
    missing = [p for p in masks if not p.exists()]
    if not images or missing:
        raise SystemExit(f'{split}: {len(images)} images, {len(missing)} missing masks')
    print(f'{split}: verified {len(images)} image/mask pairs')
PY

echo "$(date -Iseconds) Starting segmentation training" >> "$log"
exec "$root/.venv-water/bin/python" "$root/ml/segmentation/train.py" >> "$log" 2>&1
