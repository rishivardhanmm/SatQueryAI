import type { ImageInput, Mode, Evidence } from '../domain';
export function demoImages(mode: Mode): ImageInput[] {
  return Array.from({ length: mode === 'single' ? 1 : 2 }, (_, i) => ({
    id: `demo-${mode}-${i}`,
    name:
      mode === 'fusion'
        ? i
          ? 'sar_reference.tif'
          : 'optical_reference.tif'
        : mode === 'change'
          ? `urban_${i ? 'after' : 'before'}.tif`
          : 'optical_scene.tif',
    size: 18400000,
    format: 'GeoTIFF',
    width: 1024,
    height: 1024,
    bands: mode === 'fusion' && i ? 1 : 3,
    crs: 'EPSG:32643',
    resolution: [10, 10],
    bounds: [400000, 2500000, 410240, 2510240],
    date: mode === 'change' ? (i ? '2026-02-14' : '2024-02-11') : '2026-02-14',
    sensor: mode === 'fusion' && i ? 'SAR fixture' : 'Optical fixture',
    modality: mode === 'fusion' && i ? 'SAR' : 'Optical',
    preview: '/satellite.jpg',
    demo: true,
    registration: true,
  }));
}
// Normalized illustrative polygons. A 10.24 km square fixture grid makes
// shoelace polygon areas reproducible; these are NOT detected real-world features.
const polygons: {
  kind: Evidence['kind'];
  label: string;
  points: number[][];
}[] = [
  {
    kind: 'built',
    label: 'B1 · Built-up region',
    points: [
      [0.1, 0.3],
      [0.29, 0.27],
      [0.34, 0.43],
      [0.18, 0.48],
    ],
  },
  {
    kind: 'built',
    label: 'B2 · Built-up region',
    points: [
      [0.52, 0.54],
      [0.7, 0.48],
      [0.78, 0.65],
      [0.58, 0.74],
    ],
  },
  {
    kind: 'change',
    label: 'C1 · North-east expansion',
    points: [
      [0.67, 0.14],
      [0.87, 0.16],
      [0.89, 0.32],
      [0.76, 0.37],
      [0.65, 0.27],
    ],
  },
  {
    kind: 'change',
    label: 'C2 · Eastern expansion',
    points: [
      [0.8, 0.45],
      [0.91, 0.44],
      [0.94, 0.61],
      [0.83, 0.63],
    ],
  },
  {
    kind: 'water',
    label: 'W1 · Water region',
    points: [
      [0.43, 0.05],
      [0.49, 0.07],
      [0.46, 0.28],
      [0.51, 0.46],
      [0.44, 0.67],
      [0.49, 0.92],
      [0.42, 0.96],
      [0.37, 0.68],
      [0.43, 0.45],
      [0.39, 0.27],
    ],
  },
  {
    kind: 'vegetation',
    label: 'V1 · Vegetation',
    points: [
      [0.1, 0.58],
      [0.3, 0.55],
      [0.34, 0.75],
      [0.17, 0.85],
      [0.07, 0.76],
    ],
  },
];
export function polygonArea(points: number[][], extent = 10240) {
  return (
    ((Math.abs(
      points.reduce((sum, p, i) => {
        const n = points[(i + 1) % points.length];
        return sum + p[0] * n[1] - n[0] * p[1];
      }, 0),
    ) /
      2) *
      extent *
      extent) /
    1e6
  );
}
export const evidence: Evidence[] = polygons.map((p, i) => ({
  ...p,
  id: `region-${i + 1}`,
  area: polygonArea(p.points),
}));
