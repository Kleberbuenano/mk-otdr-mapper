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
        if (projection.distanceMeters > endpointToSegmentMeters) continue;

        // If the endpoint is also within the endpoint-merge tolerance of a
        // target vertex, the endpoint-endpoint candidate already describes
        // this relationship. Avoid drawing a second amber alert at the same
        // junction as an endpoint-to-segment warning.
        const nearestTargetVertex = Math.min(
          haversine(endpoint.point, start),
          haversine(endpoint.point, end)
        );
        if (nearestTargetVertex <= endpointMergeMeters) continue;
        if (projection.fraction <= 1e-6 || projection.fraction >= 1 - 1e-6) continue;

        {
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

  for (let first = 0; first < segments.length; first++) {
    const aPoints = segments[first];
    if (!Array.isArray(aPoints)) continue;
    for (let second = first + 1; second < segments.length; second++) {
      const bPoints = segments[second];
      if (!Array.isArray(bPoints)) continue;
      for (let ai = 1; ai < aPoints.length; ai++) {
        const a = aPoints[ai - 1], b = aPoints[ai];
        if (!validPoint(a) || !validPoint(b)) continue;
        for (let bi = 1; bi < bPoints.length; bi++) {
          const c = bPoints[bi - 1], d = bPoints[bi];
          if (!validPoint(c) || !validPoint(d)) continue;
          const intersection = findInteriorIntersection(a, b, c, d);
          if (intersection) candidates.push({
            kind: 'segment-crossing',
            a: { segmentIndex: first, edgeIndex: ai - 1 },
            b: { segmentIndex: second, edgeIndex: bi - 1 },
            point: intersection.point,
            fractionA: intersection.fractionA,
            fractionB: intersection.fractionB,
            distanceMeters: 0,
            requiresConfirmation: true,
            connects: false
          });
        }
      }
    }
  }


  return candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
}


function findInteriorIntersection(a, b, c, d) {
  const originLat = (a.lat + b.lat + c.lat + d.lat) / 4;
  const metersPerDegreeLat = 111132.92;
  const metersPerDegreeLng = 111412.84 * Math.cos(originLat * Math.PI / 180);
  const xy = p => ({
    x: (p.lng - a.lng) * metersPerDegreeLng,
    y: (p.lat - a.lat) * metersPerDegreeLat
  });
  const p = xy(a), p2 = xy(b), q = xy(c), q2 = xy(d);
  const rx = p2.x - p.x, ry = p2.y - p.y;
  const sx = q2.x - q.x, sy = q2.y - q.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return null;
  const qpx = q.x - p.x, qpy = q.y - p.y;
  const t = (qpx * sy - qpy * sx) / denominator;
  const u = (qpx * ry - qpy * rx) / denominator;
  const epsilon = 1e-6;
  if (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon) return null;
  return {
    fractionA: t,
    fractionB: u,
    point: {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t
    }
  };
}


/**
 * Reports segment components using exact shared endpoint coordinates only.
 * This is a geometry diagnostic, not proof of optical continuity.
 */
function analyzeEndpointConnectivity(segments, precision = 6) {
  if (!Array.isArray(segments)) throw new TypeError('segments must be an array');
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
    throw new RangeError('precision must be an integer from 0 to 12');
  }
  const keyOf = point => validPoint(point)
    ? point.lat.toFixed(precision) + ',' + point.lng.toFixed(precision)
    : null;
  const endpointOwners = new Map();
  const validSegments = [];
  segments.forEach((points, segmentIndex) => {
    if (!Array.isArray(points) || points.length < 2 ||
        !validPoint(points[0]) || !validPoint(points.at(-1))) return;
    validSegments.push(segmentIndex);
    for (const [end, point] of [['start', points[0]], ['end', points.at(-1)]]) {
      const key = keyOf(point);
      if (!endpointOwners.has(key)) endpointOwners.set(key, []);
      endpointOwners.get(key).push({ segmentIndex, end });
    }
  });
  const adjacency = new Map(validSegments.map(index => [index, new Set()]));
  const endpointDegree = [];
  for (const [coordinate, owners] of endpointOwners) {
    endpointDegree.push({ coordinate, degree: owners.length, owners });
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const a = owners[i].segmentIndex, b = owners[j].segmentIndex;
        if (a !== b) {
          adjacency.get(a).add(b);
          adjacency.get(b).add(a);
        }
      }
    }
  }
  const components = [];
  const unseen = new Set(validSegments);
  while (unseen.size) {
    const first = unseen.values().next().value;
    const stack = [first], members = [];
    unseen.delete(first);
    while (stack.length) {
      const current = stack.pop();
      members.push(current);
      for (const neighbor of adjacency.get(current)) {
        if (unseen.delete(neighbor)) stack.push(neighbor);
      }
    }
    components.push(members.sort((a, b) => a - b));
  }
  return {
    method: 'exact-endpoint-coordinate-match',
    components,
    disconnectedComponentCount: components.length,
    isolatedSegments: validSegments.filter(index => adjacency.get(index).size === 0),
    danglingEndpoints: endpointDegree.filter(item => item.degree === 1),
    junctionCandidates: endpointDegree.filter(item => item.degree > 2),
    requiresFieldConfirmation: true,
    provesOpticalContinuity: false
  };
}

const api = { findProximityCandidates, analyzeEndpointConnectivity };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.MKTopologyAudit = api;
