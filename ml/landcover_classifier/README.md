# Land-cover tile classifier

Trains a ten-class EuroSAT RGB model: AnnualCrop, Forest, HerbaceousVegetation, Highway, Industrial, Pasture, PermanentCrop, Residential, River, and SeaLake.

This is the trained SatQuery land-cover specialist. It classifies a satellite image tile as water, green/vegetated, urban/built-up, agricultural, or another EuroSAT class. The checked-in checkpoint has 90.22% held-out accuracy and 89.87% macro F1; see [RESULTS.md](RESULTS.md). It is not a segmentation model and does not create exact pixel masks.

Run with `.venv-water/bin/python ml/landcover_classifier/train.py`.
