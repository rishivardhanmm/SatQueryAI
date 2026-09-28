"""Download small, attributable Sentinel-2 RGB crops for SatQuery demos.

Uses the public Microsoft Planetary Computer STAC catalogue and a short-lived
read URL for each chosen COG. Images are real Sentinel-2 L2A observations;
the accompanying manifest records acquisition details and query windows.
"""
from __future__ import annotations
import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'field-demo-examples'
STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
SIGN = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign?href='

# Each pair is a real candidate demonstration. The manifest preserves its
# source date and cloud score; visual review decides whether it is promoted.
CASES = {
    'vegetation-seasonal-nebraska': {
        'center': (-97.00, 40.75), 'radius_degrees': .025,
        'before': '2023-03-01/2023-04-30', 'after': '2023-07-01/2023-08-31',
        'question': 'Has green vegetation cover changed?',
        'claim': 'Seasonal crop/vegetation contrast; not a permanent land-use claim.',
    },
    'builtup-expansion-hyderabad': {
        'center': (78.36, 17.43), 'radius_degrees': .025,
        'before': '2018-10-01/2019-03-31', 'after': '2024-10-01/2025-03-31',
        'question': 'Has built-up area increased?',
        'claim': 'Candidate urban and industrial expansion scene; requires visual review before presentation.',
    },
    'lake-mead-water-loss': {
        'center': (-114.85, 36.05), 'radius_degrees': .025,
        'before': '2018-12-01/2019-01-31', 'after': '2024-12-01/2025-01-31',
        'question': 'Has water coverage changed?',
        'claim': 'Candidate reservoir water-extent comparison; validates the water model.',
    },
}

def request_json(url: str, payload: dict | None = None):
    body = json.dumps(payload).encode() if payload else None
    request = Request(url, data=body, headers={'Content-Type': 'application/json'} if body else {})
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read())

def scene(case, interval):
    lon, lat = case['center']; r = case['radius_degrees']
    payload = {'collections':['sentinel-2-l2a'], 'bbox':[lon-r,lat-r,lon+r,lat+r], 'datetime':interval, 'limit':100}
    features = request_json(STAC, payload).get('features', [])
    usable = [f for f in features if f.get('assets', {}).get('visual', {}).get('href')]
    if not usable: raise RuntimeError(f'No RGB Sentinel-2 scene found for {interval}')
    return min(usable, key=lambda f: f.get('properties', {}).get('eo:cloud_cover', 100))

def signed(href: str) -> str:
    return request_json(SIGN + quote(href, safe=''))['href']

def crop(feature, case, path: Path):
    href = signed(feature['assets']['visual']['href'])
    lon, lat = case['center']
    with rasterio.open(href) as src:
        x, y = transform('EPSG:4326', src.crs, [lon], [lat])
        col, row = src.index(x[0], y[0]); size = min(1024, src.width, src.height)
        window = Window(max(0, col-size//2), max(0, row-size//2), min(size, src.width), min(size, src.height)).round_offsets().round_lengths()
        data = src.read([1,2,3], window=window, out_shape=(3,768,768), resampling=rasterio.enums.Resampling.bilinear)
    # TCI is display-ready uint8 for Sentinel-2 visual assets.
    Image.fromarray(np.moveaxis(data, 0, -1)).save(path, quality=92)

def main():
    OUT.mkdir(parents=True, exist_ok=True); manifest=[]
    for slug, case in CASES.items():
        folder = OUT / slug; folder.mkdir(exist_ok=True)
        record={'id':slug, **case, 'source':'Copernicus Sentinel-2 L2A via Microsoft Planetary Computer', 'review_status':'needs_visual_review'}
        for label in ('before','after'):
            feature=scene(case, case[label]); filename=f'{label}.jpg'; crop(feature,case,folder/filename)
            props=feature['properties'];record[label]={'file':f'{slug}/{filename}','scene_id':feature['id'],'datetime':props.get('datetime'),'cloud_cover':props.get('eo:cloud_cover'),'visual_asset':feature['assets']['visual']['href']}
        manifest.append(record);print(f'Downloaded {slug}',flush=True)
    (OUT/'MANIFEST.json').write_text(json.dumps(manifest,indent=2))

if __name__ == '__main__': main()
