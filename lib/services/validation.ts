import type { ImageInput, Mode, Validation, Check } from '../domain';
export function validateImages(
  images: ImageInput[],
  requested: Mode = 'auto',
): Validation {
  const mode: Mode =
    requested === 'auto'
      ? images.length === 2
        ? images.some((i) => i.modality === 'SAR') &&
          images.some((i) => ['Optical', 'Multispectral'].includes(i.modality))
          ? 'fusion'
          : 'change'
        : 'single'
      : requested;
  const checks: Check[] = [];
  const add = (name: string, status: Check['status'], detail: string) =>
    checks.push({ name, status, detail });
  const count = mode === 'single' ? 1 : 2;
  add(
    'Image count',
    images.length === count ? 'pass' : 'fail',
    `${images.length} of ${count} required images`,
  );
  add(
    'File format',
    images.length &&
      images.every((i) => ['TIFF', 'GeoTIFF', 'PNG', 'JPEG'].includes(i.format))
      ? 'pass'
      : 'fail',
    'GeoTIFF, TIFF, PNG and JPEG supported',
  );
  add(
    'Band count',
    images.length && images.every((i) => i.bands > 0) ? 'pass' : 'fail',
    'At least one readable raster band required',
  );
  add(
    'Modality',
    images.some((i) => i.modality === 'Unknown') ? 'warning' : 'pass',
    images.map((i) => i.modality).join(' + ') || 'No imagery',
  );
  if (mode === 'fusion')
    add(
      'Sensor pairing',
      images.some((i) => i.modality === 'SAR') &&
        images.some((i) => ['Optical', 'Multispectral'].includes(i.modality))
        ? 'pass'
        : 'fail',
      'Requires optical / multispectral and SAR',
    );
  const geo =
    images.length > 0 && images.every((i) => i.crs && i.bounds && i.resolution);
  add(
    'Geo metadata',
    geo ? 'pass' : 'warning',
    geo
      ? 'CRS, bounds and pixel resolution available'
      : 'Missing georeferencing. Geographic measurements unavailable.',
  );
  if (images.length === 2) {
    const [a, b] = images;
    const same = !!a.crs && a.crs === b.crs;
    const matchingImageGrid =
      !a.crs &&
      !b.crs &&
      a.width === b.width &&
      a.height === b.height &&
      ['PNG', 'JPEG'].includes(a.format) &&
      ['PNG', 'JPEG'].includes(b.format);
    add(
      'CRS',
      same || matchingImageGrid ? 'pass' : 'fail',
      same
        ? `${a.crs} · compatible`
        : matchingImageGrid
          ? 'No CRS · matching exported image grid accepted for coverage comparison'
        : 'Pair must share a known CRS; reproject before analysis.',
    );
    if (same && a.bounds && b.bounds) {
      const [x1, y1, x2, y2] = a.bounds,
        [u1, v1, u2, v2] = b.bounds;
      const overlap =
        Math.max(0, Math.min(x2, u2) - Math.max(x1, u1)) *
        Math.max(0, Math.min(y2, v2) - Math.max(y1, v1));
      const denom = Math.min((x2 - x1) * (y2 - y1), (u2 - u1) * (v2 - v1));
      const pct = denom > 0 ? (100 * overlap) / denom : 0;
      add(
        'Geographic overlap',
        pct >= 90 ? 'pass' : 'fail',
        `${pct.toFixed(1)}% overlap · minimum 90% required`,
      );
    } else if (matchingImageGrid)
      add(
        'Geographic overlap',
        'pass',
        'Matching 2D export dimensions. Geographic overlap cannot be independently verified.',
      );
    else
      add(
        'Geographic overlap',
        'fail',
        'Cannot calculate overlap without matching CRS and bounds.',
      );
    const res =
      a.resolution &&
      b.resolution &&
      a.resolution.every(
        (r, i) =>
          Math.abs(Math.abs(r) - Math.abs(b.resolution![i])) <=
          Math.abs(r) * 0.05,
      );
    add(
      'Resolution',
      res || matchingImageGrid ? 'pass' : 'fail',
      res
        ? 'Pixel sizes within 5% tolerance'
        : matchingImageGrid
          ? 'Matching exported pixel dimensions'
        : 'Resample to a compatible pixel grid.',
    );
    add(
      'Registration',
      a.demo && b.demo ? 'pass' : 'warning',
      a.demo && b.demo
        ? 'Aligned illustrative fixture grid'
        : 'Unverified. Metadata overlap does not prove pixel co-registration.',
    );
    if (mode === 'change')
      add(
        'Acquisition dates',
        a.date && b.date && a.date !== b.date ? 'pass' : 'warning',
        'Distinct acquisition dates are required to interpret temporal change.',
      );
  }
  return {
    mode,
    ready: checks.every((c) => c.status !== 'fail'),
    checks,
    warnings: checks.filter((c) => c.status !== 'pass').map((c) => c.detail),
  };
}
