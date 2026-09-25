# Run the trained water-change model locally

This connects the saved EuroSAT water-classifier checkpoint to the existing SatQuery AI specialist-gateway contract.

## What it does

For a valid before/after RGB image pair of the same place, the service divides each image into an 8 × 8 grid. It predicts water probability for each matching tile, compares the probabilities, highlights changed tiles, and reports estimated water coverage before and after.

It is deliberately a **tile-level estimate**, not an exact river polygon or km² measurement. Exact boundaries and area are the next segmentation-model milestone.

## Start the service

```bash
MODEL_API_KEY=local-demo-key .venv-water/bin/uvicorn backend.main:app --port 8000
```

Then configure the SatQuery AI local runtime with the same token and `INFERENCE_URL=http://127.0.0.1:8000`. Upload two corresponding PNG or JPEG satellite images, choose **Bi-temporal pair**, and ask: `Has water coverage increased?`

## What to show

- The gateway health endpoint says the `change` adapter is active.
- The saved checkpoint was selected by validation F1 and scored 90.75% water F1 on 1,650 held-out EuroSAT tiles.
- The workspace shows tile evidence, estimated before/after water coverage, confidence, model score, and limitations.
- The result is valid only when the images are from the same area, correctly aligned, and comparable in date/sensor/quality.
