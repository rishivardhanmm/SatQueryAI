"""Optional specialist inference gateway. No trained weights are bundled.

Implement and register a Specialist adapter to activate inference. The hosted
controller intentionally abstains until this gateway returns validated evidence.
"""
from __future__ import annotations
import os
from typing import Literal, Protocol
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

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
