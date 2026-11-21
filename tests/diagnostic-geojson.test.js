const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiagnosticGeoJSON } = require('../src/diagnostic-geojson');

const baseLat = -2.6;
const baseLng = -56.8;
const metersToLat = meters => meters / 111132.92;
const metersToLng = meters => meters / (111412.84 * Math.cos(baseLat * Math.PI / 180));

test('builds a diagnostic-only FeatureCollection without mutating source segments', () => {
  const shared = { lat: baseLat, lng: baseLng };
  const segments = [
    [shared, { lat: baseLat, lng: baseLng + metersToLng(50) }],
    [{ lat: baseLat, lng: baseLng + metersToLng(50) },
      { lat: baseLat, lng: baseLng + metersToLng(100) }],
    [{ lat: baseLat + metersToLat(100), lng: baseLng },
      { lat: baseLat + metersToLat(100), lng: baseLng + metersToLng(50) }]
  ];
  const original = structuredClone(segments);
  const result = buildDiagnosticGeoJSON(segments);

  assert.equal(result.type, 'FeatureCollection');
  assert.deepEqual(segments, original);
  assert.equal(result.properties.diagnosticOnly, true);
  assert.equal(result.properties.changesOperationalGraph, false);
  assert.equal(result.properties.opticalContinuityConfirmed, false);

  const lines = result.features.filter(feature => feature.properties.diagnosticType === 'segment');
  assert.equal(lines.length, 3);
  assert.equal(lines.find(feature => feature.properties.segmentIndex === 0).properties.style, 'blue');
  assert.equal(lines.find(feature => feature.properties.segmentIndex === 1).properties.style, 'blue');
  assert.equal(lines.find(feature => feature.properties.segmentIndex === 2).properties.style, 'red');
});

test('marks proximity candidates amber and does not turn them into connections', () => {
  const segments = [
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat, lng: baseLng + metersToLng(50) }],
    [{ lat: baseLat + metersToLat(5), lng: baseLng + metersToLng(50) },
      { lat: baseLat + metersToLat(5), lng: baseLng + metersToLng(100) }]
  ];
  const result = buildDiagnosticGeoJSON(segments);
  const alerts = result.features.filter(feature =>
    feature.properties.diagnosticType === 'proximity-candidate');

  assert.ok(alerts.length > 0);
  assert.ok(alerts.every(feature => feature.properties.style === 'amber'));
  assert.ok(alerts.every(feature => feature.properties.requiresFieldConfirmation));
  assert.ok(alerts.every(feature => !feature.properties.opticalContinuityConfirmed));
  assert.equal(result.properties.changesOperationalGraph, false);
});

test('rejects non-array segment input', () => {
  assert.throws(() => buildDiagnosticGeoJSON(null), TypeError);
});

test('rejects invalid coordinate precision through the audit contract', () => {
  assert.throws(() => buildDiagnosticGeoJSON([], { precision: 13 }), RangeError);
});


test('does not show amber proximity alert for an exactly shared endpoint', () => {
  const shared = { lat: baseLat, lng: baseLng };
  const segments = [
    [shared, { lat: baseLat, lng: baseLng + metersToLng(50) }],
    [{ lat: baseLat, lng: baseLng }, { lat: baseLat + metersToLat(50), lng: baseLng }]
  ];
  const result = buildDiagnosticGeoJSON(segments);
  assert.equal(result.properties.proximityCandidateCount, 0);
  assert.equal(result.features.some(feature =>
    feature.properties.diagnosticType === 'proximity-candidate'), false);
});
