const test = require('node:test');
const assert = require('node:assert/strict');
const { findProximityCandidates, analyzeEndpointConnectivity } = require('../src/topology-audit');

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

test('interior crossing of two cable segments is flagged but never connected', () => {
  const horizontal = [
    { lat: baseLat, lng: baseLng - metersToLng(50) },
    { lat: baseLat, lng: baseLng + metersToLng(50) }
  ];
  const vertical = [
    { lat: baseLat - metersToLat(50), lng: baseLng },
    { lat: baseLat + metersToLat(50), lng: baseLng }
  ];
  const candidates = findProximityCandidates([horizontal, vertical]);
  const crossing = candidates.find(item => item.kind === 'segment-crossing');
  assert.ok(crossing);
  assert.equal(crossing.distanceMeters, 0);
  assert.ok(Math.abs(crossing.point.lat - baseLat) < 1e-8);
  assert.ok(Math.abs(crossing.point.lng - baseLng) < 1e-8);
  assert.equal(crossing.requiresConfirmation, true);
  assert.equal(crossing.connects, false);
});

test('collinear overlapping segments are not reported as a point crossing', () => {
  const first = [
    { lat: baseLat, lng: baseLng },
    { lat: baseLat, lng: baseLng + metersToLng(100) }
  ];
  const second = [
    { lat: baseLat, lng: baseLng + metersToLng(25) },
    { lat: baseLat, lng: baseLng + metersToLng(75) }
  ];
  const candidates = findProximityCandidates([first, second]);
  assert.equal(candidates.some(item => item.kind === 'segment-crossing'), false);
});


test('endpoint connectivity reports separate components without snapping nearby segments', () => {
  const segments = [
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat, lng: baseLng + metersToLng(50) }],
    [{ lat: baseLat, lng: baseLng + metersToLng(50) }, { lat: baseLat, lng: baseLng + metersToLng(100) }],
    [{ lat: baseLat + metersToLat(2), lng: baseLng + metersToLng(100) },
      { lat: baseLat + metersToLat(2), lng: baseLng + metersToLng(150) }]
  ];
  const report = analyzeEndpointConnectivity(segments);
  assert.deepEqual(report.components, [[0, 1], [2]]);
  assert.equal(report.disconnectedComponentCount, 2);
  assert.deepEqual(report.isolatedSegments, [2]);
  assert.equal(report.provesOpticalContinuity, false);
});

test('endpoint connectivity flags degree-three junction candidates', () => {
  const shared = { lat: baseLat, lng: baseLng };
  const segments = [
    [shared, { lat: baseLat, lng: baseLng + metersToLng(30) }],
    [shared, { lat: baseLat + metersToLat(30), lng: baseLng }],
    [shared, { lat: baseLat - metersToLat(30), lng: baseLng }]
  ];
  const report = analyzeEndpointConnectivity(segments);
  assert.equal(report.junctionCandidates.length, 1);
  assert.equal(report.junctionCandidates[0].degree, 3);
  assert.deepEqual(report.components, [[0, 1, 2]]);
});

test('endpoint connectivity rejects invalid precision', () => {
  assert.throws(() => analyzeEndpointConnectivity([], 13), RangeError);
});
