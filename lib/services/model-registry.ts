export const models = [
  {
    id: 'vlm',
    name: 'Remote-Sensing VLM',
    version: '1.0.0',
    description:
      'Scene-level understanding, grounded in remote-sensing concepts.',
    capabilities: [
      'Visual question answering',
      'Scene description',
      'Land-cover interpretation',
    ],
    input: 'Optical / multispectral',
    adaptation:
      'Adapter interface ready. BigEarthNet-compatible data integration planned; no trained weights bundled.',
    icon: 'scan',
  },
  {
    id: 'grounding',
    name: 'Grounding Model',
    version: '1.0.0',
    description: 'Connect natural-language references with spatial regions.',
    capabilities: [
      'Text-guided localization',
      'Bounding boxes',
      'Region masks',
    ],
    input: 'Optical / multispectral',
    adaptation: 'Replaceable specialist adapter',
    icon: 'target',
  },
  {
    id: 'change',
    name: 'Change Intelligence',
    version: '1.0.0',
    description: 'Compare spatially corresponding observations over time.',
    capabilities: [
      'Change detection',
      'Change description',
      'Change-based VQA',
    ],
    input: 'Co-registered bi-temporal pair',
    adaptation: 'Replaceable specialist adapter',
    icon: 'layers',
  },
  {
    id: 'fusion',
    name: 'Optical–SAR Fusion',
    version: '1.0.0',
    description: 'Combine visual detail with complementary radar observations.',
    capabilities: [
      'Joint sensor analysis',
      'Water detection',
      'Built-up analysis',
    ],
    input: 'Co-registered optical + SAR pair',
    adaptation: 'Replaceable specialist adapter',
    icon: 'orbit',
  },
  {
    id: 'geo',
    name: 'Geospatial Engine',
    version: '1.0.0',
    description:
      'Validate raster metadata and calculate reproducible spatial measurements.',
    capabilities: [
      'CRS validation',
      'Overlap calculation',
      'Region area',
      'Raster inspection',
    ],
    input: 'GeoTIFF / TIFF / PNG / JPEG',
    adaptation:
      'Metadata validation active; registration assessment requires a specialist endpoint.',
    icon: 'globe',
  },
];
export function routeTask(query: string, mode: string) {
  const q = query.toLowerCase();
  if (mode === 'fusion')
    return {
      task: 'Optical–SAR Joint Analysis',
      tools: ['fusion', 'grounding', 'geo'],
    };
  if (mode === 'change')
    return {
      task: /describe|what changed/.test(q)
        ? 'Change Description'
        : /highlight|where|regions/.test(q) &&
            !/increased|has|decreased/.test(q)
          ? 'Change Detection'
          : 'Change-Based VQA',
      tools: ['change', 'grounding', 'geo'],
    };
  if (/highlight|locate|where|ground|mark|outline/.test(q))
    return { task: 'Text-Guided Grounding', tools: ['grounding', 'geo'] };
  return {
    task: /describe|caption|land.cover/.test(q)
      ? 'Scene Description'
      : 'Visual Question Answering',
    tools: ['vlm', 'geo'],
  };
}
