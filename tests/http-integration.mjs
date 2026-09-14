import assert from 'node:assert/strict';
import { writeArrayBuffer } from 'geotiff';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
async function api(path, body, method = 'POST') {
  const r = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
}
const created = [];
try {
  for (const mode of ['single', 'change', 'fusion']) {
    const a = await api('/api/query', {
      demo: mode,
      query:
        mode === 'single'
          ? 'Highlight the water body'
          : mode === 'change'
            ? 'Has the built-up area increased?'
            : 'Use both images to identify water and built-up regions',
    });
    assert.equal(a.status, 'complete');
    assert.ok(a.evidence.length);
    created.push(a.id);
    const saved = await api('/api/analysis/' + a.id, null, 'GET');
    assert.equal(saved.id, a.id);
    const report = await fetch(`${base}/api/reports/${a.id}?format=json`);
    assert.equal((await report.json()).id, a.id);
    if (mode === 'change') {
      const pdf = await fetch(`${base}/api/reports/${a.id}?format=pdf`);
      assert.equal(pdf.status, 200);
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), '%PDF');
      assert.ok(bytes.length > 20000);
    }
    console.log('PASS demo, persistence and report:', mode);
  }
  const duplicate = await api('/api/analysis', { id: created[0] });
  created.push(duplicate.id);
  assert.notEqual(duplicate.id, created[0]);
  const pixels = new Uint8Array(64 * 64 * 3).fill(80);
  const bytes = writeArrayBuffer(pixels, {
    width: 64,
    height: 64,
    SamplesPerPixel: 3,
    BitsPerSample: [8, 8, 8],
    PhotometricInterpretation: 2,
    ModelPixelScale: [10, 10, 0],
    ModelTiepoint: [0, 0, 0, 400000, 2510240, 0],
    ProjectedCSTypeGeoKey: 32643,
    GTModelTypeGeoKey: 1,
  });
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/tiff' }), '2024.tif');
  const upload = await fetch(base + '/api/images', {
    method: 'POST',
    body: form,
  });
  const image = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(image));
  assert.equal(image.width, 64);
  assert.equal(image.crs, 'EPSG:32643');
  const v = await api('/api/validate', { imageIds: [image.id] });
  assert.equal(v.ready, true);
  const a = await api('/api/query', {
    imageIds: [image.id],
    query: 'Describe the scene',
  });
  created.push(a.id);
  assert.equal(a.status, 'abstained');
  assert.equal(a.confidence, null);
  assert.equal(a.evidence.length, 0);
  console.log('PASS real GeoTIFF upload, metadata, validation and abstention');
  const bad = new FormData();
  bad.append('file', new Blob(['invalid file']), 'malformed.tif');
  assert.equal(
    (await fetch(base + '/api/images', { method: 'POST', body: bad })).status,
    400,
  );
  assert.equal(
    (
      await fetch(base + '/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: 'single', query: '' }),
      })
    ).status,
    400,
  );
  console.log('PASS corrupt upload and empty query rejection');
  const h = await api('/api/history', null, 'GET');
  assert.ok(h.some((x) => x.id === a.id));
  console.log('PASS history and duplicate');
} finally {
  for (const id of created) {
    await api('/api/analysis/' + id, null, 'DELETE');
    assert.equal((await fetch(base + '/api/analysis/' + id)).status, 404);
  }
  console.log('PASS deletion and missing-record handling');
}
