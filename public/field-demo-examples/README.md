# Real imagery demo examples

Each folder contains a real Sentinel-2 RGB before/after export and the recorded scene provenance in `MANIFEST.json`. Upload `before.jpg` first, then `after.jpg`, select **Optical**, choose **Bi-temporal pair**, and use the listed question.

| Example | Use now? | Question | What it proves |
| --- | --- | --- | --- |
| `water-lake-mead-proven` | Yes | `Has water coverage changed?` | The dedicated water model was directly tested on this pair and estimates a water-coverage decrease. |
| `builtup-expansion-hyderabad` | Yes | `Has built-up area increased?` | The trained land-cover model directly estimated built-up coverage rising from 0.0% to 24.2% across its aligned tile grid. It is a coverage estimate, not a building-footprint mask. |
| `vegetation-seasonal-nebraska` | Visual review only | `Has green vegetation cover changed?` | The imagery visibly changes from brown spring fields to greener late-summer fields. Do not use it to claim the current coarse model has detected this change: its independent tile classifications did not meet a useful confidence threshold. It becomes a mask-model test when LoveDA training completes. |

## Road and industrial claims

Do not present a road or industrial-footprint demonstration as already detected. At 10 m Sentinel-2 display resolution, individual roads are often too narrow, and the current model has no pixel-mask or road-change checkpoint. The LoveDA segmentation stage includes **road** and **building** pixel labels; the LEVIR stage provides construction-change masks. Those models will be added to this folder only after they meet their held-out metric gate.

## Provenance and responsible use

The generated pairs are Copernicus Sentinel-2 L2A visual assets queried through Microsoft Planetary Computer. `MANIFEST.json` records scene IDs, acquisition timestamps, cloud cover, and original visual-asset URLs. These JPEG exports have no CRS, so the app may report coverage percentages but must not report km².
