import type { ImageInput } from '../domain';
export async function inspectRaster(file: File): Promise<ImageInput> {
  if (file.size > 25 * 1024 * 1024)
    throw Error(
      'Maximum upload size is 25 MB per image. Tile larger rasters before uploading.',
    );
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['tif', 'tiff', 'png', 'jpg', 'jpeg'].includes(ext || ''))
    throw Error('Unsupported format. Use GeoTIFF, TIFF, PNG or JPEG.');
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let width = 0,
    height = 0,
    bands = 0,
    crs: string | null = null,
    resolution: number[] | null = null,
    bounds: number[] | null = null,
    date: string | null = null;
  const tiff = ext === 'tif' || ext === 'tiff';
  if (tiff) {
    const { fromArrayBuffer } = await import('geotiff');
    const image = await (await fromArrayBuffer(buf)).getImage();
    width = image.getWidth();
    height = image.getHeight();
    bands = image.getSamplesPerPixel();
    const keys = image.getGeoKeys();
    const epsg = keys?.ProjectedCSTypeGeoKey || keys?.GeographicTypeGeoKey;
    if (epsg && epsg !== 32767) crs = `EPSG:${epsg}`;
    try {
      resolution = image.getResolution().slice(0, 2);
      bounds = image.getBoundingBox();
    } catch {}
    const fd = image.getFileDirectory() as any;
    date = fd.DateTime ? String(fd.DateTime).replaceAll('\0', '') : null;
  } else if (ext === 'png') {
    if (
      bytes[0] !== 137 ||
      bytes[1] !== 80 ||
      bytes[2] !== 78 ||
      bytes[3] !== 71
    )
      throw Error('File contents are not a valid PNG.');
    const v = new DataView(buf);
    width = v.getUint32(16);
    height = v.getUint32(20);
    bands = bytes[25] === 6 ? 4 : bytes[25] === 2 ? 3 : 1;
  } else {
    if (bytes[0] !== 255 || bytes[1] !== 216)
      throw Error('File contents are not a valid JPEG.');
    let p = 2;
    while (p + 8 < bytes.length) {
      if (bytes[p] !== 255) {
        p++;
        continue;
      }
      const marker = bytes[p + 1];
      p += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      const len = (bytes[p] << 8) + bytes[p + 1];
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        height = (bytes[p + 3] << 8) + bytes[p + 4];
        width = (bytes[p + 5] << 8) + bytes[p + 6];
        bands = bytes[p + 7];
        break;
      }
      if (len < 2) break;
      p += len;
    }
  }
  if (!width || !height || width * height > 16000000)
    throw Error(
      'Raster unreadable or exceeds 16 million pixels. Upload a smaller tile.',
    );
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    format: tiff ? (crs ? 'GeoTIFF' : 'TIFF') : ext === 'png' ? 'PNG' : 'JPEG',
    width,
    height,
    bands,
    crs,
    resolution,
    bounds,
    date,
    sensor: null,
    modality:
      bands >= 3 ? (bands > 4 ? 'Multispectral' : 'Optical') : 'Unknown',
    preview: '',
  };
}
