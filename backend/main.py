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


class WaterChangeAdapter:
    """Tile-level water estimate for a co-registered before/after RGB pair.

    It highlights grid cells whose water probability changes. It deliberately
    reports coverage percentage, not geographic area: exact area needs a
    segmentation model and validated raster georeferencing.
    """
    def __init__(self):
        root = Path(__file__).resolve().parents[1]
        checkpoint = root / 'ml' / 'water_classifier' / 'artifacts' / 'water-cnn-eurosat.pt'
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

try:
    adapters['change'] = WaterChangeAdapter()
except RuntimeError:
    pass
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
