# EuroSAT land-cover model results

This local specialist is a compact CNN trained on the 10 EuroSAT RGB land-cover classes: AnnualCrop, Forest, HerbaceousVegetation, Highway, Industrial, Pasture, PermanentCrop, Residential, River, and SeaLake.

| Split | Images | Result |
| --- | ---: | --- |
| Training | 18,900 | Used with spatial-style image augmentation |
| Validation | 4,050 | Best macro F1: 89.75% |
| Held-out test | 4,050 | Accuracy: 90.22%; macro F1: 89.87% |

The application groups its outputs as follows:

- **Water:** River and SeaLake
- **Green / vegetated:** Forest, HerbaceousVegetation, Pasture, AnnualCrop, and PermanentCrop
- **Built-up / urban:** Highway, Industrial, and Residential

The model makes one prediction for each tile in a 16 × 16 image grid. Its output is a tile-level coverage estimate and evidence overlay, not an exact pixel mask. For two aligned images, SatQuery compares predictions for matching tiles to estimate land-cover transitions. A dedicated temporal change model and pixel masks require a dataset with those labels.

Run the reproducible training job with:

```bash
.venv-water/bin/python ml/landcover_classifier/train.py
```
