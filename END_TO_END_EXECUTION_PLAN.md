# SatQuery AI end-to-end execution plan

## Goal

Turn the current local demonstration into an evidence-first satellite-image analysis product. Every answer must identify the specialist model used, show spatial evidence, report a task-specific confidence, and abstain when the imagery or model scope is unsuitable.

The existing trained models remain useful baselines:

- `water-cnn-eurosat.pt`: water/non-water tile classification and pairwise water coverage estimate.
- `landcover-cnn-eurosat.pt`: ten-class land-cover tile classification, grouped into water, vegetation, and built-up cover.

They are not presented as exact mask or operational change models. The stages below replace their coarse evidence as labelled data becomes available.

## Delivery order

| Stage | Deliverable | Data and labels | Acceptance evidence | Dependency |
| --- | --- | --- | --- | --- |
| 1 | Pixel-mask segmentation baseline | LoveDA RGB images and masks: building, road, water, barren, forest, agriculture, background | Per-class IoU, mean IoU, rendered prediction examples, saved checkpoint | Official train/validation archives |
| 2 | Pixel-mask specialist in the app | Stage 1 checkpoint | Single-image mask overlays, mask coverage and class-specific evidence | Stage 1 metric gate |
| 3 | Construction-change baseline | LEVIR-CD before/after pairs with binary building-change masks | Held-out change IoU, precision, recall, F1, rendered before/after/change examples | Dataset access and download |
| 4 | Change specialist in the app | Stage 3 checkpoint plus Stage 1 masks | Building-change overlay; mask-derived water and vegetation transition overlays | Stages 2 and 3 |
| 5 | Geospatial evidence engine | GeoTIFF metadata, CRS, affine transform, optional AOI | Image alignment checks; real km² only when CRS/transform are valid | Stage 4 |
| 6 | Optical–SAR fusion baseline | Paired Sentinel-1/Sentinel-2 labelled data, starting with BigEarthNet/SEN12MS-compatible manifests | Optical-only vs fused held-out comparison, modality availability policy | Public data access and hardware |
| 7 | Reliability policy | Calibration and held-out results from all specialists | Confidence thresholds, cloud/misalignment/unsupported-modality abstention tests | Stages 1–6 metrics |
| 8 | Target-area validation pack | Team-collected, independently reviewed target-location imagery and labels | Frozen unseen test set, error analysis, model cards | Annotation specification and human review |
| 9 | Release package | All accepted checkpoints, registry, runbook, sample data, regression tests | Clean-machine run, demo walkthrough, reproducibility manifest | Stages 1–8 |

## Model design

### A. Single-image segmentation

Train a compact U-Net first because it is easy to inspect and reproduce. Input is an RGB image tile; output is one class for every pixel. The loss ignores LoveDA's no-data pixels. Evaluation reports class IoU for water, building, forest, and agriculture, plus mean IoU across all seven classes.

The application will map model classes to user-facing groups:

- Water: `water`
- Green cover: `forest` and `agriculture`
- Built-up: `building` and `road`

This is a real mask model. It can support exact pixel overlays, but real-world area is only calculated where valid georeferencing is supplied.

### B. Construction change

Train a Siamese U-Net: it receives a co-registered before image and after image, encodes both with shared weights, compares their feature maps, and produces a binary pixel mask of building change. The first benchmark is LEVIR-CD because its labels specifically identify construction growth and decline. It must not be used to claim water or vegetation change.

### C. Water and vegetation transitions

For the first version, run the segmentation model on each aligned date and compare the two masks pixel-by-pixel. The result is a *mask-derived land-cover transition*. It is explicitly labelled that way until a separately trained multi-class temporal-change dataset is available.

### D. Optical–SAR fusion

Use a two-branch architecture: one encoder for optical imagery and one for SAR, with learned feature fusion before the segmentation/change head. Do not activate this model until paired data, sensor normalization, and optical-only comparison metrics are available.

## Data, annotations, and governance

Public data bootstraps the models; it does not validate the final target deployment. The project must create a target-area validation set with imagery from different locations and dates than training.

Required human annotation rules:

1. Water: permanent water, seasonal water, flood water, and shadow exclusions.
2. Vegetation: forest/tree canopy, crop land, grass/shrub, and bare soil boundaries.
3. Built-up: building footprint, road, industrial hard surface, construction site, and demolition.
4. Change: label the changed boundary and change type; reject pairs with irrecoverable cloud, seasonal mismatch, or registration error.
5. Every label receives a reviewer state: drafted, reviewed, accepted, rejected. A second reviewer resolves disagreements.

Store immutable image IDs, acquisition date, sensor, bands, CRS, bounds, annotation version, annotator/reviewer IDs, and split assignment. Split geographically, not randomly, so that neighbouring tiles do not leak into test results.

## Metric gates

No model is registered into the user-facing product merely because training finished.

| Specialist | Minimum evidence before registration |
| --- | --- |
| Segmentation | Held-out mean IoU and per-class IoU, visual review of errors, checkpoint and data manifest |
| Construction change | Held-out change F1, precision/recall, visual false-positive/false-negative review |
| Mask-derived transitions | Alignment validation, class-specific transition examples, clearly stated scope |
| Fusion | Same held-out locations, optical-only baseline comparison, modality-missing behavior |
| Answer controller | Regression tests proving it selects the correct specialist or abstains |

Thresholds are selected after baseline measurements and error review rather than invented in advance.

## Hardware and execution

The current Apple-silicon local environment can train compact RGB baselines, though the full LoveDA job may take hours. For repeatable 512px segmentation and pair-change experiments, use one NVIDIA GPU with at least 24 GB VRAM, 64 GB RAM, and 200 GB free SSD. Store raw public datasets outside Git. Checkpoints, source, metrics, data manifests, and small demo samples are committed or versioned separately.

## Immediate execution sequence

1. Finish the LoveDA download, extract it, audit image/mask pairing, and train the segmentation baseline.
2. Generate held-out metrics and visual prediction artifacts. Register the checkpoint only if its metrics and visual review are usable.
3. Integrate the model into the FastAPI gateway and React overlays.
4. Acquire LEVIR-CD through its official access route, then train and evaluate the construction-change baseline.
5. Add geospatial metadata validation and measured-area calculations for GeoTIFF inputs.
6. Build public-data manifests for optical–SAR fusion; train only after the paired corpus is available.
7. Add model registry, confidence calibration, reliability/abstention rules, model cards, and clean-machine regression validation.

## Current status at plan approval

- Stage 1 source pipeline is implemented and its official LoveDA training archive is downloading locally.
- The current product has trained tile-level water and land-cover specialists; they remain available as fallback evidence while mask/change models are trained.
- Stages 2–9 are not represented as complete until their stated acceptance evidence exists.
