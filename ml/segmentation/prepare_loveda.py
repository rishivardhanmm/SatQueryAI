"""Extract the official LoveDA archives into the local ignored data directory."""
from __future__ import annotations
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data' / 'raw' / 'loveda'
DEST = ROOT / 'data' / 'processed' / 'loveda'

for split in ('Train', 'Val'):
    archive = RAW / f'{split}.zip'
    if not archive.exists():
        raise SystemExit(f'Missing {archive}. Download the official LoveDA archive first.')
    print(f'Extracting {archive.name}…')
    with zipfile.ZipFile(archive) as zipped:
        zipped.extractall(DEST)
print(f'Ready: {DEST}')
