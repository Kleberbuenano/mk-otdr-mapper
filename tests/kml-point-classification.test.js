const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyKmlPoints } = require('../src/kml-point-classification');

test('known CEO and SITE/PT names retain their existing classifications', () => {
  const result = classifyKmlPoints([
    { name: 'CEO 01', lat: -2.6, lng: -56.8 },
    { name: 'CEO 03', lat: -2.61, lng: -56.81 },
    { name: 'PT09', lat: -2.62, lng: -56.82 },
    { name: 'SITE Aeroporto', lat: -2.63, lng: -56.83 }
  ]);
  assert.equal(result.boxes.length, 2);
  assert.equal(result.boxes[0].concentrator, false);
  assert.equal(result.boxes[1].concentrator, true);
  assert.deepEqual(result.sites.map(point => point.name), ['PT09', 'SITE Aeroporto']);
  assert.deepEqual(result.genericPoints, []);
});

test('named points outside known patterns are preserved as generic points', () => {
  const source = [
    { name: 'AMPT9', lat: -2.6, lng: -56.8, description: 'Ponto de referência' },
    { name: 'PRT', lat: -2.61, lng: -56.81, description: 'Terminal' },
    { name: 'BOI', lat: -2.62, lng: -56.82, description: '' }
  ];
  const result = classifyKmlPoints(source);
  assert.deepEqual(result.genericPoints, source);
  assert.equal(result.boxes.length, 0);
  assert.equal(result.sites.length, 0);
});

test('invalid point records are ignored and input objects are not mutated', () => {
  const valid = { name: 'Marco', lat: -2.6, lng: -56.8 };
  const source = [valid, { name: 'Sem coordenada', lat: NaN, lng: -56.8 }, null];
  const before = JSON.stringify(source);
  const result = classifyKmlPoints(source);
  assert.deepEqual(result.genericPoints, [valid]);
  assert.equal(JSON.stringify(source), before);
});

test('non-array input is rejected', () => {
  assert.throws(() => classifyKmlPoints(null), TypeError);
});
