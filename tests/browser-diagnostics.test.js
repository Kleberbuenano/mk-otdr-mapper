const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildDiagnosticGeoJSON } = require('../dist/diagnostic-geojson');

test('Vercel browser assets expose diagnostic scripts and controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.match(html, /\.\/topology-audit\.js/);
  assert.match(html, /\.\/diagnostic-geojson\.js/);
  assert.match(html, /toggleTopologyDiagnostics\(\)/);
  assert.match(html, /function refreshTopologyDiagnostics\(\)/);
});

test('deployed diagnostic bundle produces GeoJSON with safe metadata', () => {
  const p = { lat: -2.6, lng: -56.8 };
  const q = { lat: -2.6, lng: -56.799 };
  const result = buildDiagnosticGeoJSON([[p, q]]);
  assert.equal(result.type, 'FeatureCollection');
  assert.equal(result.properties.diagnosticOnly, true);
  assert.equal(result.properties.changesOperationalGraph, false);
  assert.equal(result.properties.opticalContinuityConfirmed, false);
});
