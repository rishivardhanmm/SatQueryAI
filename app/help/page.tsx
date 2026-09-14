import AppShell from '@/components/app-shell';
import {
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  Satellite,
  Layers3,
  Orbit,
  Target,
} from 'lucide-react';
export default function Page() {
  return (
    <AppShell active="Documentation">
      <main className="content-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">A FIELD GUIDE TO SATQUERY</div>
            <h1>From imagery to understanding.</h1>
            <p>Everything you need to start an evidence-grounded analysis.</p>
          </div>
          <a className="primary" href="/workspace?demo=change">
            Try a demo <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="help-layout">
          <nav className="help-nav">
            <a href="#start">Getting started</a>
            <a href="#inputs">Input configurations</a>
            <a href="#validation">Validation & uncertainty</a>
            <a href="#glossary">Geospatial glossary</a>
            <a href="#integration">Model integration</a>
            <a href="#sources">Data & attribution</a>
          </nav>
          <div className="help-content">
            <section id="start">
              <h2>One question. An observable workflow.</h2>
              <p>
                SatQuery routes your question to specialist tools, integrates
                spatial evidence, and returns an answer alongside confidence and
                an execution record.
              </p>
              <ol>
                <li>
                  <strong>Add imagery.</strong> Select New analysis and upload
                  one or two images, or choose a curated demo.
                </li>
                <li>
                  <strong>Review validation.</strong> Inspect CRS, resolution,
                  overlap and modality. Select the correct modality when it
                  cannot be inferred.
                </li>
                <li>
                  <strong>Ask your question.</strong> Use natural language or a
                  suggested question.
                </li>
                <li>
                  <strong>Inspect the evidence.</strong> Toggle layers, compare
                  observations and open the Trace tab.
                </li>
                <li>
                  <strong>Keep the record.</strong> Results save automatically.
                  Download a PDF or JSON report.
                </li>
              </ol>
            </section>
            <section id="inputs">
              <h2>Three input configurations</h2>
              {[
                {
                  title: 'Single image',
                  text: 'One optical, multispectral or SAR image. Scene description, visual questions and text-guided region grounding.',
                  query: '“Highlight the water body.”',
                },
                {
                  title: 'Bi-temporal pair',
                  text: 'Two spatially corresponding images captured at different times. Change detection, descriptions and change-based questions.',
                  query: '“Has the built-up area increased?”',
                },
                {
                  title: 'Optical + SAR pair',
                  text: 'Co-registered optical and radar observations of the same area. Joint water and built-up interpretation.',
                  query:
                    '“Use both sensors to identify water-covered regions.”',
                },
              ].map((x) => (
                <article className="help-input" key={x.title}>
                  <h3>{x.title}</h3>
                  <p>{x.text}</p>
                  <blockquote>{x.query}</blockquote>
                </article>
              ))}
            </section>
            <section id="validation">
              <h2>Evidence includes knowing when to stop.</h2>
              <p>
                Files are checked for readable raster dimensions, band count and
                supported format. Paired imagery requires matching CRS, at least
                90% geographic overlap and pixel resolutions within 5%. Metadata
                agreement does not prove co-registration.
              </p>
              <p>
                PNG and JPEG can support visual tasks, but generally lack
                georeferencing. No geographic area is calculated when reliable
                georeferencing is missing. TIFF metadata does not reliably
                identify SAR; confirm modality from the source product.
              </p>
              <div className="notice">
                <ShieldCheck size={21} />
                <p>
                  No trained model weights are included in this release. Real
                  uploads are inspected, but inference is withheld until a
                  validated model is connected. Demo answers, confidence, dates
                  and spatial masks are explicitly illustrative.
                </p>
              </div>
              <p>
                Supported upload limits: 25 MB per file, 16 million pixels, two
                images per workspace. Tile larger products before upload.
                Unsupported or corrupt files are rejected.
              </p>
            </section>
            <section id="glossary">
              <h2>A little geospatial vocabulary.</h2>
              {[
                [
                  'SAR',
                  'Synthetic Aperture Radar — radar imagery capable of operating day and night and through cloud cover.',
                ],
                [
                  'GeoTIFF',
                  'A raster format that can include geographic coordinates, a coordinate reference system and pixel resolution.',
                ],
                [
                  'CRS',
                  'Coordinate Reference System — defines how image coordinates correspond to positions on Earth.',
                ],
                [
                  'Co-registration',
                  'Alignment of images so corresponding pixels represent the same geographic location.',
                ],
                [
                  'Bi-temporal',
                  'Two observations of the same area captured at different times.',
                ],
                [
                  'Spatial grounding',
                  'Connecting a word or description to a visible region, box or mask.',
                ],
              ].map(([term, definition]) => (
                <details key={term}>
                  <summary>{term}</summary>
                  <p>{definition}</p>
                </details>
              ))}
            </section>
            <section id="integration">
              <h2>Specialist tools, replaceable by design.</h2>
              <p>
                The controller routes by input mode and query intent. Separate
                input, validation, registry, evidence, measurement, confidence
                and report services isolate the UI from inference providers.
              </p>
              <p>
                The production integration point is the Python FastAPI service
                adapter in the repository. Provide validated model weights and a
                registered inference adapter; preserve the typed result
                contract, emit masks before measurements, and calibrate
                confidence against an evaluation set.
              </p>
              <p>
                Available API resources: images, validate, query, analysis,
                models, reports and history. The current hosted runtime uses
                Cloudflare database and object storage. PostgreSQL/PostGIS,
                Redis and MinIO deployment services are supplied for extending
                the Python backend.
              </p>
            </section>
            <section id="sources">
              <h2>Reference imagery & attribution</h2>
              <p>
                Contains modified Copernicus Sentinel data (2022), processed by
                ESA. The Kolkata reference is resized for web display under CC
                BY-SA 3.0 IGO. Grayscale sensor previews are illustrative
                transformations, not acquired SAR data.
              </p>
              <a
                className="text-link"
                href="https://www.esa.int/ESA_Multimedia/Images/2023/02/Earth_from_Space_Kolkata_India"
                target="_blank"
                rel="noreferrer"
              >
                ESA: Earth from Space — Kolkata, India ↗
              </a>
              <a
                className="text-link"
                href="https://creativecommons.org/licenses/by-sa/3.0/igo/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 3.0 IGO license ↗
              </a>
              <p>
                The fixture grid, polygons, confidence scores and dates are
                demonstration data. They must not be used for real-world
                operational decisions.
              </p>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
