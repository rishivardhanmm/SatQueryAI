import type { Analysis, ImageInput, Mode, Evidence } from '../domain';
import { validateImages } from './validation';
import { routeTask, models } from './model-registry';
import { evidence, polygonArea } from './fixtures';

export function analyze(
  query: string,
  images: ImageInput[],
  mode: Mode = 'auto',
  threshold = 0.7,
): Analysis {
  const start = Date.now();
  const validation = validateImages(images, mode);
  const route = routeTask(query, validation.mode);
  const demo = images.length > 0 && images.every((i) => i.demo);
  const q = query.toLowerCase();
  const unsupported =
    /predict|future|tomorrow|population|people|owner|ownership|identity|name of|military|crop yield|exact age|economic/.test(
      q,
    );
  const wrongMode =
    validation.mode === 'single' &&
    /change|increas|decreas|before|after|flood.area/.test(q);
  const abstained =
    !validation.ready || !demo || unsupported || wrongMode || threshold > 0.89;
  let selected = evidence.filter(
    (e) => validation.mode === 'change' || e.kind !== 'change',
  );
  let subject = 'Built-up';
  let decreasing = false;
  if (validation.mode === 'change' && /vegetation|forest/.test(q)) {
    subject = 'Vegetation';
    decreasing = true;
    const points = [
      [0.17, 0.6],
      [0.29, 0.59],
      [0.3, 0.69],
      [0.19, 0.72],
    ];
    selected = [
      ...evidence.filter((e) => e.kind === 'vegetation'),
      {
        id: 'vegetation-change',
        kind: 'change',
        label: 'C1 · Vegetation decrease',
        points,
        area: polygonArea(points),
      },
    ];
  } else if (validation.mode === 'change' && /water|flood/.test(q)) {
    subject = 'Water-covered';
    const points = [
      [0.49, 0.36],
      [0.55, 0.39],
      [0.51, 0.58],
      [0.47, 0.61],
      [0.5, 0.46],
    ];
    selected = [
      ...evidence.filter((e) => e.kind === 'water'),
      {
        id: 'water-change',
        kind: 'change',
        label: 'C1 · Water expansion',
        points,
        area: polygonArea(points),
      },
    ];
  } else if (route.task === 'Text-Guided Grounding') {
    if (/water/.test(q)) selected = selected.filter((e) => e.kind === 'water');
    else if (/built|buildings|urban/.test(q))
      selected = selected.filter((e) => e.kind === 'built');
    else if (/vegetation|forest|agricultur/.test(q))
      selected = selected.filter((e) => e.kind === 'vegetation');
  }
  const answer = unsupported
    ? 'This question asks for information that cannot be reliably observed in the imagery. Please ask about visible land cover, spatial regions, or observable change.'
    : wrongMode
      ? 'A single observation cannot establish change or reliably estimate flood extent. Upload a co-registered pre/post-event pair or corresponding SAR imagery.'
      : !validation.ready
        ? 'The inputs are not compatible. Resolve the validation failures before analysis.'
        : !demo
          ? 'The imagery has been inspected, but specialist inference is not connected. No detection, confidence, or area estimate has been fabricated. Connect a validated model endpoint to analyze these inputs.'
          : threshold > 0.89
            ? 'The illustrative detection confidence is below your configured threshold. No result meets the required confidence.'
            : validation.mode === 'change'
              ? subject === 'Vegetation'
                ? 'Vegetation decreased in the illustrative comparison. The highlighted loss zone sits in the south-western vegetation region. The measurements below are derived from the fixture polygon.'
                : subject === 'Water-covered'
                  ? 'Water-covered area increased in the illustrative comparison. The highlighted expansion follows the eastern side of the central water corridor. This demo does not establish a real flood event.'
                  : 'Built-up area increased in this illustrative comparison. The largest expansion is concentrated in the north-eastern region, with a smaller zone along the eastern edge.'
              : validation.mode === 'fusion'
                ? /additional|compare|sar provide/.test(q)
                  ? 'SAR provides complementary radar backscatter information and can observe through cloud cover. In this illustrative workflow, water and built-up masks are combined with the optical reference. The displayed grayscale preview is not acquired SAR imagery.'
                  : 'The illustrative fused interpretation identifies a continuous water region and two built-up zones. SAR complements optical observations where clouds can limit visible detail.'
                : /water/.test(q)
                  ? 'A water region is highlighted in the illustrative evidence. Its elongated extent contrasts with the surrounding built-up and vegetation regions.'
                  : /built|buildings|urban/.test(q)
                    ? 'Two built-up regions are highlighted in the illustrative evidence, alongside vegetation and a water corridor.'
                    : /vegetation|forest|agricultur/.test(q)
                      ? 'The illustrative vegetation region occupies the south-western part of the fixture grid. Crop type and forest condition cannot be reliably determined from this demo.'
                      : 'The illustrative scene contains urban areas, vegetation, a water corridor, and connecting roads. Built-up regions form compact clusters beside the water.';
  const baseKind =
    subject === 'Vegetation'
      ? 'vegetation'
      : subject === 'Water-covered'
        ? 'water'
        : 'built';
  const before = selected
    .filter((e) => e.kind === baseKind)
    .reduce((s, e) => s + e.area, 0);
  const delta =
    selected
      .filter((e) => e.kind === 'change')
      .reduce((s, e) => s + e.area, 0) * (decreasing ? -1 : 1);
  const sign = delta >= 0 ? '+' : '';
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    query,
    mode: validation.mode,
    task: route.task,
    images,
    answer,
    confidence: abstained ? null : 89,
    breakdown: abstained
      ? []
      : [
          { label: 'Input compatibility', value: 100 },
          { label: 'Detection confidence', value: 91 },
          { label: 'Evidence agreement', value: 87 },
        ],
    tools: route.tools.map((id) => models.find((m) => m.id === id)!.name),
    steps: [
      'Query classified',
      ...validation.checks.map((c) => `${c.name}: ${c.status} — ${c.detail}`),
      abstained ? 'Inference withheld' : 'Curated fixture evidence loaded',
      abstained
        ? 'No evidence produced'
        : 'Polygon areas calculated from fixture grid',
      'Response assembled',
    ],
    parameters: { tileSize: 512, overlap: 64, threshold },
    duration: Math.max(0.01, (Date.now() - start) / 1000),
    status: abstained ? 'abstained' : 'complete',
    evidence: abstained ? [] : selected,
    metrics: abstained
      ? []
      : validation.mode === 'change'
        ? [
            {
              label: `Time 1 ${subject.toLowerCase()}`,
              value: before.toFixed(2) + ' km²',
            },
            {
              label: `Time 2 ${subject.toLowerCase()}`,
              value: (before + delta).toFixed(2) + ' km²',
            },
            {
              label: decreasing ? 'Net decrease' : 'Net increase',
              value: sign + delta.toFixed(2) + ' km²',
            },
            {
              label: 'Relative change',
              value: sign + ((delta / before) * 100).toFixed(1) + '%',
            },
          ]
        : [
            { label: 'Evidence regions', value: String(selected.length) },
            {
              label: 'Highlighted area',
              value:
                selected.reduce((s, e) => s + e.area, 0).toFixed(2) + ' km²',
            },
          ],
    limitations: demo
      ? [
          'Illustrative demo: model outputs, dates, CRS, sensor pairing and confidence are curated fixtures, not a validated analysis of the reference photograph.',
          'Areas are calculated from illustrative polygons on a 10.24 km fixture grid; do not use for operational decisions.',
          ...validation.warnings,
        ]
      : [
          'Real model weights are not bundled. Inference is intentionally withheld.',
          ...validation.warnings,
        ],
    demo,
  };
}
