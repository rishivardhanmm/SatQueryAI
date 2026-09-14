import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateImages } from '../lib/services/validation';
import { demoImages, polygonArea } from '../lib/services/fixtures';
import { analyze } from '../lib/services/agent-controller';
import { routeTask } from '../lib/services/model-registry';
test('auto detection distinguishes temporal and sensor pairs', () => {
  assert.equal(validateImages(demoImages('change')).mode, 'change');
  assert.equal(validateImages(demoImages('fusion')).mode, 'fusion');
});
test('non-overlapping and mismatched CRS inputs are blocked', () => {
  const imgs = demoImages('change');
  imgs[1].bounds = [0, 0, 100, 100];
  assert.equal(validateImages(imgs).ready, false);
  imgs[1].crs = 'EPSG:4326';
  assert.equal(
    validateImages(imgs).checks.find((c) => c.name === 'CRS')?.status,
    'fail',
  );
});
test('pair registration is not inferred from metadata overlap', () => {
  const imgs = demoImages('change').map((i) => ({ ...i, demo: false }));
  assert.equal(
    validateImages(imgs).checks.find((c) => c.name === 'Registration')?.status,
    'warning',
  );
});
test('mode count and sensor requirements are enforced', () => {
  assert.equal(validateImages(demoImages('single'), 'change').ready, false);
  assert.equal(validateImages(demoImages('change'), 'fusion').ready, false);
});
test('intent routes to specialist grounding and VQA', () => {
  assert.equal(
    routeTask('Highlight the water body', 'single').task,
    'Text-Guided Grounding',
  );
  assert.equal(
    routeTask('Is water visible?', 'single').task,
    'Visual Question Answering',
  );
});
test('all demo scenarios produce spatial evidence', () => {
  for (const mode of ['single', 'change', 'fusion'] as const) {
    const a = analyze('Identify visible regions', demoImages(mode));
    assert.equal(a.status, 'complete');
    assert.ok(a.evidence.length > 0);
  }
});
test('real uploads never inherit demo evidence or confidence', () => {
  const a = analyze(
    'Describe this scene',
    demoImages('single').map((i) => ({ ...i, demo: false })),
  );
  assert.equal(a.status, 'abstained');
  assert.equal(a.confidence, null);
  assert.deepEqual(a.evidence, []);
  assert.deepEqual(a.metrics, []);
});
test('single observation cannot establish change', () => {
  assert.equal(
    analyze('Has built-up area increased?', demoImages('single')).status,
    'abstained',
  );
});
test('unobservable requests and strict thresholds abstain', () => {
  assert.equal(
    analyze('Who is the owner?', demoImages('single')).status,
    'abstained',
  );
  assert.equal(
    analyze('Describe scene', demoImages('single'), 'single', 0.95).status,
    'abstained',
  );
});
test('geometry calculations use shoelace area rather than guessed statistics', () => {
  assert.equal(
    polygonArea(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      1000,
    ),
    1,
  );
  const a = analyze('What changed?', demoImages('change'));
  const change = a.evidence
    .filter((e) => e.kind === 'change')
    .reduce((s, e) => s + e.area, 0);
  assert.equal(a.metrics[2].value, '+' + change.toFixed(2) + ' km²');
});
test('vegetation and water change questions use relevant fixture evidence', () => {
  const vegetation = analyze(
    'Where did vegetation decrease?',
    demoImages('change'),
  );
  assert.match(vegetation.answer, /Vegetation decreased/);
  assert.ok(vegetation.metrics[2].value.startsWith('-'));
  const water = analyze('Has water area increased?', demoImages('change'));
  assert.match(water.answer, /Water-covered area increased/);
  assert.ok(water.evidence.some((e) => e.kind === 'water'));
  assert.equal(
    water.evidence.some((e) => e.kind === 'built'),
    false,
  );
});
test('confidence cannot fall below the requested minimum', () => {
  assert.equal(
    analyze('Describe scene', demoImages('single'), 'single', 0.9).status,
    'abstained',
  );
});
