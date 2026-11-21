const test = require('node:test');
const assert = require('node:assert/strict');
const { findProximityCandidates } = require('../src/topology-audit');

const baseLat = -2.6;
const baseLng = -56.8;
const metersToLat = meters => meters / 111132.92;
const metersToLng = meters => meters / (111412.84 * Math.cos(baseLat * Math.PI / 180));

test('nearby endpoints are reported as candidates, not optical connections', () => {
  const segments = [
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat, lng: baseLng + metersToLng(100) }],
    [{ lat: baseLat + metersToLat(8), lng: baseLng + metersToLng(100) },
      { lat: baseLat + metersToLat(8), lng: baseLng + metersToLng(200) }]
  ];
  const candidates = findProximityCandidates(segments);
  const match = candidates.find(item => item.kind === 'endpoint-endpoint');
  assert.ok(match);
  assert.ok(match.distanceMeters < 18);
  assert.equal(match.requiresConfirmation, true);
  assert.equal(match.connects, false);
});

test('endpoint near the interior of another segment is flagged for field confirmation', () => {
  const segments = [
    [{ lat: baseLat + metersToLat(10), lng: baseLng + metersToLng(50) },
      { lat: baseLat + metersToLat(30), lng: baseLng + metersToLng(50) }],
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat, lng: baseLng + metersToLng(100) }]
  ];
  const candidates = findProximityCandidates(segments);
  const match = candidates.find(item => item.kind === 'endpoint-to-segment');
  assert.ok(match);
  assert.ok(match.distanceMeters < 25);
  assert.ok(match.fraction > 0 && match.fraction < 1);
  assert.equal(match.requiresConfirmation, true);
  assert.equal(match.connects, false);
});

test('segments farther than the configured thresholds produce no candidates', () => {
  const segments = [
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat, lng: baseLng + metersToLng(100) }],
    [{ lat: baseLat + metersToLat(60), lng: baseLng + metersToLng(100) },
      { lat: baseLat + metersToLat(60), lng: baseLng + metersToLng(200) }]
  ];
  assert.deepEqual(findProximityCandidates(segments), []);
});

test('same-segment endpoints are never treated as a cross-segment candidate', () => {
  const segments = [[
    { lat: baseLat, lng: baseLng },
    { lat: baseLat, lng: baseLng + metersToLng(5) }
  ]];
  assert.deepEqual(findProximityCandidates(segments), []);
});

test('invalid thresholds are rejected', () => {
  assert.throws(
    () => findProximityCandidates([], { endpointMergeMeters: -1 }),
    RangeError
  );
});
