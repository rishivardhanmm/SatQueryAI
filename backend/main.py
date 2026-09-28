"""Optional specialist inference gateway. No trained weights are bundled.

Implement and register a Specialist adapter to activate inference. The hosted
controller intentionally abstains until this gateway returns validated evidence.
"""
from __future__ import annotations
import io
import os
from pathlib import Path
from typing import Literal, Protocol
from urllib.request import urlopen
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

# Optional local trained-model dependencies. The hosted prototype remains safe
# when these are not installed or the checkpoint is absent.
try:
    import torch
    from PIL import Image
    from torchvision import transforms
except ImportError:  # pragma: no cover - keeps the adapter optional
    torch = None

app = FastAPI(title='SatQuery AI Specialist Gateway', version='1.0.0')
class ImageInput(BaseModel):
    id: str
    name: str
    modality: str
    crs: str | None = None
    bounds: list[float] | None = None
    resolution: list[float] | None = None
    width: int
    height: int
    bands: int
class InferenceRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    mode: Literal['single', 'change', 'fusion']
    images: list[ImageInput] = Field(min_length=1, max_length=2)
    threshold: float = Field(default=.7, ge=.5, le=.99)
    image_urls: list[str] = Field(default_factory=list, max_length=2)
class Region(BaseModel):
    id: str
    label: str
    kind: Literal['built', 'water', 'vegetation', 'change']
    points: list[list[float]] = Field(min_length=3)
    area: float = Field(ge=0, description='Area in km², calculated from mask and projected CRS')
class InferenceResult(BaseModel):
    answer: str
    confidence: int = Field(ge=0, le=100)
    evidence: list[Region]
    metrics: list[dict[str,str]]
    limitations: list[str]
    steps: list[str]
class Specialist(Protocol):
    async def predict(self, request: InferenceRequest) -> InferenceResult: ...

# Register evaluated adapters here. Keep model loading outside request handlers.
adapters: dict[str, Specialist] = {}


class WaterCNN(torch.nn.Module if torch else object):
    """Same compact architecture used by ml/water_classifier/train.py."""
    def __init__(self):
        super().__init__()
        self.features = torch.nn.Sequential(
            torch.nn.Conv2d(3, 32, 3, padding=1), torch.nn.BatchNorm2d(32), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(32, 64, 3, padding=1), torch.nn.BatchNorm2d(64), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(64, 128, 3, padding=1), torch.nn.BatchNorm2d(128), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(128, 128, 3, padding=1), torch.nn.BatchNorm2d(128), torch.nn.ReLU(), torch.nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = torch.nn.Sequential(torch.nn.Flatten(), torch.nn.Dropout(.25), torch.nn.Linear(128, 2))
    def forward(self, x): return self.classifier(self.features(x))


class LandCoverCNN(torch.nn.Module if torch else object):
    """Architecture used by ml/landcover_classifier/train.py."""
    def __init__(self, n=10):
        super().__init__()
        self.features = torch.nn.Sequential(
            torch.nn.Conv2d(3, 32, 3, padding=1), torch.nn.BatchNorm2d(32), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(32, 64, 3, padding=1), torch.nn.BatchNorm2d(64), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(64, 128, 3, padding=1), torch.nn.BatchNorm2d(128), torch.nn.ReLU(), torch.nn.MaxPool2d(2),
            torch.nn.Conv2d(128, 128, 3, padding=1), torch.nn.BatchNorm2d(128), torch.nn.ReLU(), torch.nn.AdaptiveAvgPool2d(1),
        )
        self.head = torch.nn.Sequential(torch.nn.Flatten(), torch.nn.Dropout(.25), torch.nn.Linear(128, n))
    def forward(self, x): return self.head(self.features(x))


class WaterChangeAdapter:
    """Tile-level water estimate for a co-registered before/after RGB pair.

    It highlights grid cells whose water probability changes. It deliberately
    reports coverage percentage, not geographic area: exact area needs a
    segmentation model and validated raster georeferencing.
    """
    def __init__(self):
        root = Path(__file__).resolve().parents[1]
        checkpoint = root / 'ml' / 'water_classifier' / 'model' / 'water-cnn-eurosat.pt'
        if torch is None or not checkpoint.exists():
            raise RuntimeError('Water model checkpoint or local ML runtime is unavailable.')
        self.model = WaterCNN()
        self.model.load_state_dict(torch.load(checkpoint, map_location='cpu', weights_only=False)['model_state_dict'])
        self.model.eval()
        self.transform = transforms.Compose([transforms.Resize((64, 64)), transforms.ToTensor(), transforms.Normalize((.485,.456,.406),(.229,.224,.225))])

    def _grid(self, image):
        image = image.convert('RGB')
        # EuroSAT training chips are 64 × 64 Sentinel-2 pixels. A 16 × 16
        # grid keeps inference tiles closer to that footprint for a 768px
        # exported Sentinel-2 image than the earlier coarse 8 × 8 grid.
        cols, rows = 16, 16
        tiles = []
        for row in range(rows):
            for col in range(cols):
                box = (col * image.width // cols, row * image.height // rows, (col + 1) * image.width // cols, (row + 1) * image.height // rows)
                tiles.append(self.transform(image.crop(box)))
        with torch.no_grad():
            probabilities = torch.softmax(self.model(torch.stack(tiles)), dim=1)[:, 1].tolist()
        return probabilities, cols, rows

    async def predict(self, request: InferenceRequest) -> InferenceResult:
        if len(request.image_urls) != 2:
            raise ValueError('The water-change adapter requires two local image URLs.')
        images = [Image.open(io.BytesIO(urlopen(url, timeout=20).read())) for url in request.image_urls]
        before, cols, rows = self._grid(images[0])
        after, _, _ = self._grid(images[1])
        before_coverage = sum(p >= .5 for p in before) / len(before) * 100
        after_coverage = sum(p >= .5 for p in after) / len(after) * 100
        delta = after_coverage - before_coverage
        changed = []
        for i, (p1, p2) in enumerate(zip(before, after)):
            if abs(p2 - p1) >= .20:
                col, row = i % cols, i // cols
                changed.append(Region(id=f'water-tile-{i}', label=f'Water probability: {p1:.0%} → {p2:.0%}', kind='change', points=[[col/cols,row/rows],[(col+1)/cols,row/rows],[(col+1)/cols,(row+1)/rows],[col/cols,(row+1)/rows]], area=0))
        confidence = round(100 * sum(max(p, 1-p) for p in before + after) / (len(before) + len(after)))
        direction = 'increased' if delta > 0 else 'decreased' if delta < 0 else 'did not materially change'
        return InferenceResult(
            answer=f'The trained EuroSAT water classifier estimates that tile-level water coverage {direction} from {before_coverage:.1f}% to {after_coverage:.1f}% ({delta:+.1f} percentage points).',
            confidence=confidence,
            evidence=changed or [Region(id='water-grid', label='No grid cell crossed the change threshold', kind='water', points=[[0,0],[1,0],[1,1],[0,1]], area=0)],
            metrics=[{'label':'Before water coverage','value':f'{before_coverage:.1f}%'},{'label':'After water coverage','value':f'{after_coverage:.1f}%'},{'label':'Estimated change','value':f'{delta:+.1f} pp'},{'label':'Model benchmark F1','value':'90.75%'}],
            limitations=['Tile-level classifier estimate, not a pixel segmentation mask.', 'The two images must be co-registered observations of the same location.', 'Coverage percentage is not a geographic area calculation.'],
            steps=['Loaded trained water classifier checkpoint', 'Classified 16 × 16 tiles for both dates', 'Compared per-tile water probabilities', 'Returned evidence cells and coverage estimate'],
        )


class LandCoverAdapter:
    """EuroSAT tile classifier for land-cover composition and transitions.

    It is deliberately a tile-level result: this model was trained with one
    land-cover label per 64px chip, rather than pixel masks or temporal-change
    labels. Pair mode independently classifies aligned before/after tiles.
    """
    GROUPS = {
        'water': {'River', 'SeaLake'},
        'vegetation': {'AnnualCrop', 'Forest', 'HerbaceousVegetation', 'Pasture', 'PermanentCrop'},
        'built': {'Highway', 'Industrial', 'Residential'},
    }
    DISPLAY = {'water': 'water', 'vegetation': 'green / vegetated cover', 'built': 'built-up / urban cover'}

    def __init__(self):
        root = Path(__file__).resolve().parents[1]
        checkpoint = root / 'ml' / 'landcover_classifier' / 'model' / 'landcover-cnn-eurosat.pt'
        if torch is None or not checkpoint.exists():
            raise RuntimeError('Land-cover model checkpoint or local ML runtime is unavailable.')
        saved = torch.load(checkpoint, map_location='cpu', weights_only=False)
        self.classes = saved['classes']
        self.model = LandCoverCNN(len(self.classes))
        self.model.load_state_dict(saved['model_state_dict'])
        self.model.eval()
        self.transform = transforms.Compose([transforms.Resize((64, 64)), transforms.ToTensor(), transforms.Normalize((.485,.456,.406),(.229,.224,.225))])

    def _grid(self, image):
        image = image.convert('RGB'); cols = rows = 16; tiles = []
        for row in range(rows):
            for col in range(cols):
                box = (col * image.width // cols, row * image.height // rows, (col + 1) * image.width // cols, (row + 1) * image.height // rows)
                tiles.append(self.transform(image.crop(box)))
        with torch.no_grad():
            probabilities = torch.softmax(self.model(torch.stack(tiles)), dim=1)
        confidence, labels = probabilities.max(dim=1)
        groups = [next((group for group, names in self.GROUPS.items() if self.classes[label] in names), 'other') for label in labels.tolist()]
        return labels.tolist(), groups, confidence.tolist(), cols, rows

    @staticmethod
    def _target(query: str) -> str | None:
        text = query.lower()
        if any(word in text for word in ('water', 'river', 'lake', 'reservoir', 'flood')): return 'water'
        if any(word in text for word in ('green', 'vegetation', 'forest', 'crop', 'agriculture', 'tree')): return 'vegetation'
        if any(word in text for word in ('urban', 'built', 'construction', 'industrial', 'residential', 'road', 'modern')): return 'built'
        return None

    def _regions(self, groups, confidence, cols, rows, target, changed_from=None):
        regions = []
        for i, group in enumerate(groups):
            if group != target or (changed_from is not None and changed_from[i] == target): continue
            col, row = i % cols, i // cols
            regions.append(Region(id=f'{target}-tile-{i}', label=f'{self.DISPLAY[target].title()} tile ({confidence[i]:.0%} confidence)', kind=target, points=[[col/cols,row/rows],[(col+1)/cols,row/rows],[(col+1)/cols,(row+1)/rows],[col/cols,(row+1)/rows]], area=0))
        return regions[:60]

    async def predict(self, request: InferenceRequest) -> InferenceResult:
        target = self._target(request.query)
        if target is None:
            target = 'vegetation'
        if not request.image_urls:
            raise ValueError('The land-cover adapter requires a local image URL.')
        images = [Image.open(io.BytesIO(urlopen(url, timeout=20).read())) for url in request.image_urls]
        labels_before, before, conf_before, cols, rows = self._grid(images[0])
        before_pct = 100 * before.count(target) / len(before)
        if request.mode == 'single':
            evidence = self._regions(before, conf_before, cols, rows, target)
            return InferenceResult(
                answer=f'The trained EuroSAT land-cover classifier estimates {before_pct:.1f}% of the image grid as {self.DISPLAY[target]}.',
                confidence=round(100 * sum(conf_before) / len(conf_before)), evidence=evidence or [Region(id='coverage-grid', label=f'No {self.DISPLAY[target]} tile detected at the selected grid scale', kind=target, points=[[0,0],[1,0],[1,1],[0,1]], area=0)],
                metrics=[{'label':f'Estimated {self.DISPLAY[target]} coverage','value':f'{before_pct:.1f}%'},{'label':'Model benchmark accuracy','value':'90.22%'},{'label':'Model benchmark macro F1','value':'89.87%'}],
                limitations=['Tile-level land-cover estimate, not an exact pixel mask.', 'Benchmark scores are from EuroSAT RGB test tiles and may vary by sensor, geography, season, and image processing.'],
                steps=['Loaded trained ten-class EuroSAT land-cover model', 'Classified a 16 × 16 image grid', 'Mapped class predictions to water, vegetation, and built-up groups'],
            )
        if len(images) != 2:
            raise ValueError('Land-cover change estimation requires two local image URLs.')
        _, after, conf_after, _, _ = self._grid(images[1])
        after_pct = 100 * after.count(target) / len(after); delta = after_pct - before_pct
        direction = 'increased' if delta > 0 else 'decreased' if delta < 0 else 'did not materially change'
        evidence = self._regions(after, conf_after, cols, rows, target, before)
        return InferenceResult(
            answer=f'The trained land-cover model estimates {self.DISPLAY[target]} {direction} from {before_pct:.1f}% to {after_pct:.1f}% of aligned image tiles ({delta:+.1f} percentage points).',
            confidence=round(100 * sum(conf_before + conf_after) / (len(conf_before) + len(conf_after))), evidence=evidence or [Region(id='transition-grid', label=f'No {self.DISPLAY[target]} tile transition detected at the selected grid scale', kind='change', points=[[0,0],[1,0],[1,1],[0,1]], area=0)],
            metrics=[{'label':f'Before {self.DISPLAY[target]}','value':f'{before_pct:.1f}%'},{'label':f'After {self.DISPLAY[target]}','value':f'{after_pct:.1f}%'},{'label':'Estimated change','value':f'{delta:+.1f} pp'},{'label':'Model benchmark macro F1','value':'89.87%'}],
            limitations=['This is a temporal transition estimate from independently classified aligned tiles, not a separately trained change-detection model.', 'It is not an exact pixel mask or geographic-area calculation.'],
            steps=['Loaded trained ten-class EuroSAT land-cover model', 'Classified the aligned 16 × 16 grid at both dates', 'Compared grouped water, vegetation, or built-up predictions'],
        )


class ChangeRouter:
    def __init__(self, water: WaterChangeAdapter | None, landcover: LandCoverAdapter | None):
        self.water, self.landcover = water, landcover
    async def predict(self, request: InferenceRequest) -> InferenceResult:
        if LandCoverAdapter._target(request.query) == 'water' and self.water:
            return await self.water.predict(request)
        if self.landcover:
            return await self.landcover.predict(request)
        raise RuntimeError('No trained change model is available for this query.')

try:
    water_adapter = WaterChangeAdapter()
except RuntimeError:
    water_adapter = None
try:
    landcover_adapter = LandCoverAdapter()
    adapters['single'] = landcover_adapter
except RuntimeError:
    landcover_adapter = None
if water_adapter or landcover_adapter:
    adapters['change'] = ChangeRouter(water_adapter, landcover_adapter)
@app.get('/health')
def health():
    return {'status':'ready','inference_connected':bool(adapters),'adapters':list(adapters)}
@app.post('/infer', response_model=InferenceResult)
async def infer(request: InferenceRequest, authorization: str | None = Header(default=None)):
    token = os.environ.get('MODEL_API_KEY')
    if not token or authorization != f'Bearer {token}':
        raise HTTPException(401, 'A valid model service token is required.')
    adapter = adapters.get(request.mode)
    if adapter is None:
        raise HTTPException(503, 'No evaluated specialist model is registered for this input configuration.')
    return await adapter.predict(request)
