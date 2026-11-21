/* Diagnostic-only proximity audit for FTTH route segments.
 * A nearby endpoint is a review candidate, never proof of optical continuity.
 */
'use strict';

const EARTH_RADIUS_METERS = 6371008.8;

function haversine(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function projectOnSegment(point, start, end) {
  const lat0 = point.lat * Math.PI / 180;
  const metersPerDegreeLat = 111132.92;
  const metersPerDegreeLng = 111412.84 * Math.cos(lat0);
  const ax = (start.lng - point.lng) * metersPerDegreeLng;
  const ay = (start.lat - point.lat) * metersPerDegreeLat;
  const bx = (end.lng - point.lng) * metersPerDegreeLng;
  const by = (end.lat - point.lat) * metersPerDegreeLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 :
    Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  const projected = {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction
  };
  return { point: projected, fraction, distanceMeters: haversine(point, projected) };
}

function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

/**
 * Lists geometric proximity candidates between different route segments.
 * The returned records are warnings only; this function never builds graph edges.
 */
function findProximityCandidates(segments, options = {}) {
  const endpointMergeMeters = options.endpointMergeMeters ?? 18;
  const endpointToSegmentMeters = options.endpointToSegmentMeters ?? 25;
  if (!Array.isArray(segments)) throw new TypeError('segments must be an array');
  if (!(endpointMergeMeters >= 0) || !(endpointToSegmentMeters >= 0)) {
    throw new RangeError('proximity thresholds must be non-negative');
  }

  const candidates = [];
  const endpoints = [];
  segments.forEach((points, segmentIndex) => {
    if (!Array.isArray(points) || points.length < 2) return;
    if (validPoint(points[0])) endpoints.push({ point: points[0], segmentIndex, end: 'start' });
    if (validPoint(points.at(-1))) endpoints.push({ point: points.at(-1), segmentIndex, end: 'end' });
  });

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const a = endpoints[i];
      const b = endpoints[j];
      if (a.segmentIndex === b.segmentIndex) continue;
      const distanceMeters = haversine(a.point, b.point);
      if (distanceMeters <= endpointMergeMeters) {
        candidates.push({
          kind: 'endpoint-endpoint',
          a: { segmentIndex: a.segmentIndex, end: a.end },
          b: { segmentIndex: b.segmentIndex, end: b.end },
          distanceMeters,
          requiresConfirmation: true,
          connects: false
        });
      }
    }
  }

  endpoints.forEach(endpoint => {
    segments.forEach((points, segmentIndex) => {
      if (segmentIndex === endpoint.segmentIndex || !Array.isArray(points)) return;
      for (let edgeIndex = 1; edgeIndex < points.length; edgeIndex++) {
        const start = points[edgeIndex - 1];
        const end = points[edgeIndex];
        if (!validPoint(start) || !validPoint(end)) continue;
        const projection = projectOnSegment(endpoint.point, start, end);
        if (projection.fraction <= 1e-6 || projection.fraction >= 1 - 1e-6) continue;
        if (projection.distanceMeters <= endpointToSegmentMeters) {
          candidates.push({
            kind: 'endpoint-to-segment',
            endpoint: { segmentIndex: endpoint.segmentIndex, end: endpoint.end },
            target: { segmentIndex, edgeIndex: edgeIndex - 1 },
            projectedPoint: projection.point,
            fraction: projection.fraction,
            distanceMeters: projection.distanceMeters,
            requiresConfirmation: true,
            connects: false
          });
        }
      }
    });
  });

  return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

const api = { findProximityCandidates };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
