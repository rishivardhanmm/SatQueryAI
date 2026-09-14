# SatQuery AI

Evidence-grounded satellite intelligence workspace for SIH 2026 PS 26167.

## Run locally

Node 22.13+ required.

```sh
npm install
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

The app opens at the exact local URL reported by Vinext (normally http://localhost:3000).

For a supervisor demo on another device connected to the same Wi-Fi, use:

```sh
npm run dev:lan
```

Then open `http://<your-laptop-IP>:3000/workspace?demo=change` on that device. This uses your local network; it does not use ChatGPT authentication or publish the app to the internet. If macOS asks about incoming network connections, allow Node.js for your private network.

## Included

- Next-compatible React/TypeScript application, using Vinext and Cloudflare Workers.
- Four capability cards, three curated demo scenarios and three-panel imagery workspace.
- Real GeoTIFF/TIFF/PNG/JPEG metadata inspection; 25 MB / 16M pixel upload limits.
- CRS/overlap/resolution checks, modality confirmation, explicit registration warnings.
- Pan, zoom, reset, fullscreen, source-coordinate inspection, overlay/swipe/side-by-side views.
- Deterministic task routing and replaceable specialist registry.
- Typed demo evidence, geometry-derived fixture metrics, confidence and observable execution logs.
- Safe abstention for incompatible inputs, unobservable questions and unconnected inference.
- D1 persisted analyses and image metadata, R2 imagery and previews.
- Searchable/filterable history, open/duplicate/delete, PDF and JSON reports.
- Settings for browser-local confidence preference; WebMCP analysis action where supported.

## What is real and what is illustrative

The reference imagery is real Sentinel-2 Kolkata data. All demo sensor pairings, dates,
CRS, masks, confidence and analysis statements are curated illustrative fixtures.
Demo area values are calculated from vector polygons on a 10.24 km square fixture
plane. They are **not observed measurements of Kolkata**. There are no trained AI
weights or claimed domain adaptation in this repository. SAR demo views are grayscale
visualizations of the optical reference, not acquired radar observations.

Real uploads receive actual raster metadata inspection and preview. Missing geographic
metadata is not guessed. Pair overlap does not prove registration. Live inference is
withheld unless a specialist gateway is configured. This is an end-to-end demonstrator
with production-style interfaces, not an operationally validated remote-sensing system.

## Architecture

`lib/services` contains input inspection, geo validation, task controller, registry,
fixture evidence, polygon area measurement, inference adapter, storage and reports.
API routes: `/api/images`, `/api/validate`, `/api/query`, `/api/analysis/:id`,
`/api/models`, `/api/reports/:id?format=pdf|json`, `/api/history`.

The hosted app uses D1 and R2. Source schema lives in `db/schema.ts`; migrations are
in `drizzle/`. The private Site access boundary gates the entire research workspace.
This is a single workspace data model, not per-user multi-tenant isolation.

`backend/main.py` is an optional FastAPI specialist gateway. Register evaluated
adapters by input mode in its `adapters` registry, provide image bytes from trusted
storage using the input IDs, and return the validated evidence contract. Configure
`INFERENCE_URL` and `MODEL_API_KEY` as server-side runtime secrets. The UI does not
accept arbitrary inference URLs. The gateway returns 503 until an adapter is
registered; invalid/missing/low-confidence output triggers abstention.

The optional Docker Compose stack includes FastAPI, PostGIS, Redis and MinIO.
These infrastructure services are not used by the hosted D1/R2 implementation.
Copy `.env.example` to `.env` and set the required values before using Docker Compose.
Install `backend/requirements-ai.txt` separately for optional PyTorch/Transformers/PEFT
integration. Model weights, calibration, image registration, tiling and inference
implementation must be supplied for operational use.

## Verification

```sh
npx tsc --noEmit
npx tsx --test tests/domain.test.ts
npm run build
```

Tests cover mode detection, incompatible pairs, truthful registration state, routing,
all demo workflows, real-upload abstention, unsupported queries and polygon area math.
HTTP integration checks additionally exercise uploads, validation, persistence,
duplication, deletion, and PDF/JSON exports.

WebMCP is feature-detected and uses the same action as the query form. No supported
WebMCP validation context was available during implementation; that contract is unverified.

## Attribution

Contains modified Copernicus Sentinel data (2022), processed by ESA, CC BY-SA 3.0 IGO.
See `public/ATTRIBUTION.txt` and the in-app data attribution for original source and license.
The reference image was resized; its adaptations retain the source license.
