# SatQuery AI — supervisor demo guide

## Open the strongest walkthrough

Run `npm run dev`, then open:

`http://localhost:3000/workspace?demo=change`

The preloaded scenario is a **bi-temporal urban-growth workflow**. It is designed to show the product flow without needing cloud access or model credentials.

## What to show

1. Point to the two observations and the validation panel. Explain that change analysis requires a matching CRS, enough spatial overlap, compatible resolution, and image registration.
2. Read the question: “Has the built-up area increased, and where did most of the change occur?”
3. Click **Run analysis**. The app visibly classifies the task as Change-Based VQA and lists the selected specialist workflow.
4. Explain the evidence first: use the map layers and Overlay / Swipe / Side-by-side controls to inspect before/after imagery and the change regions.
5. Show the calculated metrics: before/after built-up area, net increase, relative change. In the demo, the figures come from fixture polygons through geometry calculation, rather than text generation.
6. Open **Confidence** and **Trace**. Show the input checks, selected tools, parameters, and execution steps.
7. Generate a PDF report or open Analysis History to show an auditable output.

## Honest technical explanation

This is a functional **prototype with deterministic demo inference**, not a trained production remote-sensing model.

For the curated demos, the controller receives the input mode and question, routes it to a task, loads the matching spatial evidence fixture, calculates areas from polygons, and composes a result. The reference image is real Sentinel-2 imagery of Kolkata; the paired dates, SAR preview, masks, confidence scores, and model outputs are illustrative demo data. The interface says this explicitly.

For a real upload, the app does not invent detections. It reads the raster metadata, validates format, dimensions, bands, CRS, bounds, resolution, overlap, and known modality; then it abstains until a trained specialist service is connected.

## The architecture to explain

**Input service** reads TIFF/GeoTIFF/PNG/JPEG metadata and generates a safe preview.

**Geo-validation service** checks input count, format, bands, modality, CRS, extent overlap, resolution compatibility, registration status, and temporal dates.

**Agent controller** maps the query and input configuration to a task: scene description / VQA, text-guided grounding, change detection / Change VQA, or optical-SAR fusion.

**Model registry** holds logical specialist adapters: Remote-Sensing VLM, Grounding, Change Intelligence, Optical-SAR Fusion, and Geospatial Engine. The UI does not depend on a specific vendor model.

**Evidence and measurement layer** displays masks and polygons first, calculates spatial values from geometry, then writes the textual explanation.

**Report and audit layer** persists each result with query, inputs, validation, evidence, confidence, parameters, tools, and processing steps.

## What comes next for the trained system

The UI and result contract stay the same. The team would connect evaluated specialist models behind the optional FastAPI gateway:

- Remote-sensing VLM for single-image VQA and captioning.
- Grounding / segmentation model for water, building, road, vegetation, and field masks.
- Bi-temporal change model for aligned before/after images.
- Optical-SAR fusion model for complementary sensor reasoning.
- Geospatial libraries for real area calculations from projected rasters and masks.

Only a provider response with valid spatial evidence and confidence at or above the user’s threshold is accepted. Otherwise the system abstains and tells the user what imagery or metadata is missing.

## Useful answers to supervisor questions

**“Is this GPT?”** No. No GPT or external generative model is called by the demo. The current controller is deterministic so it works offline on localhost. In the final system, a language model may be used only for task interpretation and evidence-grounded wording; it should not invent spatial facts.

**“Which models are actually running now?”** No trained ML weights are running in this prototype. The registry defines the specialist integrations and the demo uses curated evidence fixtures so the complete user journey can be demonstrated truthfully.

**“How will you make it real?”** Replace each registry adapter with an evaluated inference endpoint. The FastAPI gateway already defines a typed input/output contract and rejects invalid or insufficiently confident evidence.

**“How do you avoid hallucination?”** The interface is evidence-first. Metrics are calculated from masks/polygons, validation blocks incompatible pairs, and real uploaded images abstain until a connected model returns valid spatial outputs.

**“Why is the demo still valuable?”** It proves the end-to-end product design: image inspection, validation, task routing, model selection, evidence viewer, measurable results, uncertainty handling, reports, and history. Training can be added without redesigning the user experience.
