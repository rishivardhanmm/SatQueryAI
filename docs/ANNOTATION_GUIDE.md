# SatQuery AI annotation guide

Use this guide for project-specific imagery. Public benchmark labels train an initial model; this process creates the labels needed to prove it works in the target area.

## Required records per image or pair

Record a stable image ID, source, acquisition timestamp, sensor, band description, cloud estimate, CRS, affine transform, bounds, resolution, annotation version, annotator, reviewer, and a train/validation/test split. Use a geographic split: locations in the test set must not occur in train or validation.

## Single-date mask labels

| Class | Include | Exclude / decision rule |
| --- | --- | --- |
| Water | Rivers, lakes, reservoirs, visible floodwater | Terrain shadow and dark roofs; mark uncertain water for review rather than guessing |
| Forest / tree cover | Continuous canopy and trees | Crops and low grass belong to their own green-cover class |
| Agriculture | Cultivated fields and orchards | Bare fallow fields are reviewed as agriculture or barren according to local guidance |
| Building | Roof/building footprint or clearly built structure | Roads, parking lots, and exposed soil |
| Road / hard surface | Roads and clearly continuous paved infrastructure | Isolated bright soil or roof fragments |
| Barren | Exposed soil, sand, rock, construction earthworks | Active construction becomes a change label only when two dates prove it |

## Before/after change labels

Annotate only after confirming both images are co-registered, cover the same area, have compatible resolution, and are usable despite cloud and seasonal differences.

| Change type | Definition |
| --- | --- |
| Water gain/loss | A water mask is present in only one date after removing cloud/shadow ambiguity |
| Vegetation gain/loss | A reviewed vegetation class is gained or lost, not merely changed colour due to season |
| Construction gain/loss | Building footprint is newly present or removed; label its boundary in the later/reference grid |
| Land conversion | Transition such as agriculture to built-up, forest to barren, or barren to building |

Reject a pair when cloud, shadow, date mismatch, or registration error prevents a reliable label.

## Review protocol

1. Annotator marks masks and records uncertainty.
2. Reviewer independently inspects all changes and a representative sample of non-change pixels.
3. Reviewer marks **accepted**, **needs revision**, or **rejected**.
4. Disagreements are resolved before the label enters a frozen training split.
5. Keep rejected examples for error analysis; never silently relabel them after test evaluation.
