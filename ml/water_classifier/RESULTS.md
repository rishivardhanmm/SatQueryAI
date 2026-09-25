# Water classifier benchmark results

## Experiment

- **Dataset:** EuroSAT RGB, publicly labelled Sentinel-2 image tiles
- **Positive class:** `River` and `SeaLake` combined as water
- **Negative class:** the remaining eight EuroSAT land-cover classes
- **Model:** compact 4-block convolutional neural network
- **Data split:** 7,700 training, 1,650 validation, and 1,650 held-out test images
- **Checkpoint selection:** highest validation water F1 score

## Held-out test results

| Measure | Result |
| --- | ---: |
| Accuracy | 90.18% |
| Water precision | 85.76% |
| Water recall | 96.36% |
| Water F1 score | 90.75% |

The held-out test set contained 825 water tiles and 825 non-water tiles. The model correctly detected 795 water tiles and missed 30. It correctly rejected 693 non-water tiles and incorrectly marked 132 as water.

## Interpretation

This is a real, reproducible training result and is suitable as the first SatQuery AI specialist-model demonstration. The high recall means it finds most water tiles; the lower precision means it can raise false water alerts. SatQuery AI must show confidence and should not claim this benchmark score proves deployment performance in a new target geography.

## Reproduce

1. Download EuroSAT RGB into `data/raw/2750/`.
2. Create the virtual environment and install the dependencies.
3. Run:

```bash
.venv-water/bin/python ml/water_classifier/train.py
```

The training run writes its checkpoint, confusion matrix, held-out prediction gallery, classification report, and raw metrics to `ml/water_classifier/artifacts/`.
