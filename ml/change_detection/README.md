# Construction-change training stage

This stage trains a Siamese U-Net for **building/construction change only**. It takes a co-registered before/after RGB pair and produces a binary mask for changed building pixels.

It expects the official LEVIR-CD data under the ignored local path:

```text
data/processed/levir/
  train/{A,B,label}/
  val/{A,B,label}/
  test/{A,B,label}/
```

Run:

```bash
.venv-water/bin/python ml/change_detection/train.py
```

The model is registered only after it produces held-out precision, recall, F1, and change-IoU results plus visual error review. It does not detect water or vegetation change; those will initially use date-wise segmentation-mask comparison.
