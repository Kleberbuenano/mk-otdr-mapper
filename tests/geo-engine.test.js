const test = require('node:test');
const assert = require('node:assert/strict');
const { haversine, projectOnSegment, nearestPointOnRoute } = require('../src/geo-engine');

const close = (actual, expected, tolerance = 0.02) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);

test('haversine returns zero for the same coordinate', () => {
  assert.equal(haversine({ lat: -2.628, lng: -56.735 }, { lat: -2.628, lng: -56.735 }), 0);
});

test('projection finds the perpendicular foot inside a segment', () => {
  const result = projectOnSegment(
    { lat: 0.0005, lng: 0.005 },
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.01 }
  );
  close(result.fraction, 0.5, 0.001);
  close(result.point.lat, 0, 0.000001);
  assert.ok(result.distanceMeters > 50 && result.distanceMeters < 60);
});

test('projection clamps to the nearest endpoint when outside a segment', () => {
  const result = projectOnSegment(
    { lat: 0, lng: 0.02 },
    { lat: 0, lng: 0 },
    { lat: 0, lng: 0.01 }
  );
  close(result.fraction, 1, 0.000001);
  close(result.point.lng, 0.01, 0.000001);
});

test('nearest route point returns segment and fraction, not just a vertex', () => {
  const route = [[
    { lat: -2.6, lng: -56.8 },
    { lat: -2.6, lng: -56.79 },
    { lat: -2.6, lng: -56.78 }
  ]];
  const result = nearestPointOnRoute(
    { lat: -2.5999, lng: -56.785 },
    route,
    30
  );
  assert.ok(result);
  assert.equal(result.segmentIndex, 0);
  assert.equal(result.pointIndex, 1);
  close(result.fraction, 0.5, 0.01);
});

test('nearest route point rejects a GPS/event point outside the snap tolerance', () => {
  const route = [[
    { lat: -2.6, lng: -56.8 },
    { lat: -2.6, lng: -56.79 }
  ]];
  assert.equal(nearestPointOnRoute({ lat: -2.59, lng: -56.795 }, route, 30), null);
});

test('nearest route point returns null for an empty route', () => {
  assert.equal(nearestPointOnRoute({ lat: 0, lng: 0 }, [], 20), null);
});
