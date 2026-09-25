# Run SatQuery AI on another machine

This repository includes the first trained water-classifier checkpoint and four ready-to-use Sentinel-2 image exports. The product runs as two local processes:

1. the SatQuery AI web application on port 3000;
2. the trained-model gateway on port 8001.

## 1. Clone and install

```bash
git clone https://github.com/rishivardhanmm/SatQueryAI.git
cd SatQueryAI
npm ci
python3 -m venv .venv-water
.venv-water/bin/python -m pip install -r ml/water_classifier/requirements.txt
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
```

The included checkpoint is `ml/water_classifier/model/water-cnn-eurosat.pt`.

## 2. Configure the local gateway

Create a file named `.dev.vars` in the repository root:

```text
INFERENCE_URL=http://127.0.0.1:8001
MODEL_API_KEY=local-demo-key
```

The token is only a local development token. The two values must match the gateway command below.

## 3. Start both local services

Open two terminals in the repository root.

**Terminal 1 - trained model gateway**

```bash
MODEL_API_KEY=local-demo-key .venv-water/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Optional health check:

```bash
curl http://127.0.0.1:8001/health
```

Expected result includes `"inference_connected":true` and `"change"`.

**Terminal 2 - SatQuery AI web application**

```bash
npm run dev
```

Open `http://localhost:3000/workspace`.

## 4. Run the included examples

In the workspace, choose **Bi-temporal pair**, upload the `before` image first and the `after` image second, set both modalities to **Optical**, then ask the stated question.

| Example | Before image | After image | Query | Expected interpretation |
| --- | --- | --- | --- | --- |
| Lake Mead - positive water-change example | `public/trained-water-demo/lake-mead-before-2018-12-22.jpg` | `public/trained-water-demo/lake-mead-after-2024-12-30.jpg` | `Has water coverage increased?` | The trained model estimates a decrease in tile-level water coverage, approximately 8.6% to 5.9% in the tested local run. |
| Kolleru Lake - low-detection control | `public/trained-water-demo/kolleru-before-2024-04-14.jpg` | `public/trained-water-demo/kolleru-after-2024-12-30.jpg` | `Has water coverage increased?` | Demonstrates a known limitation: the EuroSAT model has low confidence on this aquaculture/wetland scene and should not be used for an operational conclusion. |

## What the local model does

It divides each image into a matching 16 × 16 grid, uses the trained EuroSAT classifier to score water probability for every tile, compares corresponding tile scores, and highlights changed cells. It reports estimated coverage percentage, not km², because JPEG files do not contain the georeferencing required for geographic-area calculations.

The model was trained as a water/non-water classifier on EuroSAT RGB tiles. Its held-out benchmark results are documented in `ml/water_classifier/RESULTS.md`: 90.18% accuracy and 90.75% water F1. These scores measure EuroSAT benchmark performance, not general deployment performance in every geography.

## Important troubleshooting

- **Port already in use:** change `8001` to another free port in both `.dev.vars` and the gateway command.
- **“Specialist inference is not connected”:** verify `.dev.vars`, confirm the gateway is running, then restart `npm run dev`.
- **“Add valid imagery”:** ensure exactly two matching JPEG/PNG files are uploaded and both are set to Optical.
- **No useful water result:** use the Lake Mead pair. This first classifier may not generalise to all regional image styles, wetlands, or sensors.
