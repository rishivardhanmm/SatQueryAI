# Exact-mask segmentation stage

This is the pixel-mask training stage for the parts of SatQuery that require exact boundaries. It uses the official [LoveDA dataset](https://github.com/Junjue-Wang/LoveDA), whose annotations include building, road, water, forest, agriculture, barren, and background pixels.

The dataset is intentionally stored under `data/` and never committed. After the official `Train.zip` and `Val.zip` archives are present in `data/raw/loveda/`, run:

```bash
.venv-water/bin/python ml/segmentation/prepare_loveda.py
.venv-water/bin/python ml/segmentation/train.py
```

For the full local Stage 1 sequence, use `ml/segmentation/continue_stage1.sh`. It waits for complete, integrity-checked official archives, downloads the validation archive, extracts and audits every image/mask pair, then starts training. Its progress is written to `ml/segmentation/artifacts/stage1-run.log`.

The resulting model will be evaluated with per-class IoU and mean IoU. Its outputs are distinct from the existing EuroSAT tile models: this stage is the one that produces true pixel masks for water, vegetation classes, and built-up structures.
