# First trained model: water vs non-water

This experiment trains a compact convolutional neural network on EuroSAT RGB satellite tiles. It combines the `River` and `SeaLake` classes into `water` and samples the eight remaining classes as `non-water`.

The dataset is split with a fixed seed into 70% training, 15% validation and 15% held-out testing. The best checkpoint is selected by validation water F1 score. Final metrics are calculated only on the held-out test set.

This is a benchmark proof-of-training. It is not a substitute for validating a model on the intended deployment geography, sensor and use case.

Run locally:

```bash
.venv-water/bin/python ml/water_classifier/train.py
```
