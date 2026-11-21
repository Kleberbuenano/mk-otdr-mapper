/* Geometry helpers for FTTH route snapping. No map-library dependency. */
(function (root) {
  'use strict';

  function haversine(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Local metric projection is accurate for short FTTH spans and avoids
  // treating latitude/longitude degrees as equal-sized Cartesian units.
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
    return {
      point: projected,
      fraction,
      distanceMeters: haversine(point, projected)
    };
  }

  function nearestPointOnRoute(point, segments, maxDistanceMeters = Infinity) {
    let best = null;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const points = segments[segmentIndex] || [];
      for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
        const candidate = projectOnSegment(point, points[pointIndex - 1], points[pointIndex]);
        if (!best || candidate.distanceMeters < best.distanceMeters) {
          best = {
            point: candidate.point,
            distanceMeters: candidate.distanceMeters,
            segmentIndex,
            pointIndex: pointIndex - 1,
            fraction: candidate.fraction
          };
        }
      }
    }
    if (!best || best.distanceMeters > maxDistanceMeters) return null;
    return best;
  }

  const api = { haversine, projectOnSegment, nearestPointOnRoute };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MKGeoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
