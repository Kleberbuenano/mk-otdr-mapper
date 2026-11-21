'use strict';

const topologyApi = typeof module !== 'undefined' && module.exports
  ? require('./topology-audit')
  : (typeof window !== 'undefined' ? window.MKTopologyAudit : null);
if (!topologyApi) throw new Error('MKTopologyAudit must be loaded before diagnostic-geojson.js');
const { findProximityCandidates, analyzeEndpointConnectivity } = topologyApi;

function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Converts diagnostic-only topology findings into a Leaflet-ready GeoJSON
 * FeatureCollection. It never changes route segments or creates graph edges.
 */
function buildDiagnosticGeoJSON(segments, options = {}) {
  if (!Array.isArray(segments)) throw new TypeError('segments must be an array');

  const connectivity = analyzeEndpointConnectivity(
    segments,
    options.precision === undefined ? 6 : options.precision
  );
  const proximity = findProximityCandidates(segments, options);
  const isolated = new Set(connectivity.isolatedSegments);
  const features = [];

  segments.forEach((points, segmentIndex) => {
    if (!Array.isArray(points) || points.length < 2 ||
        !points.every(validPoint)) return;
    features.push({
      type: 'Feature',
      id: 'segment-' + segmentIndex,
      geometry: {
        type: 'LineString',
        coordinates: points.map(point => [point.lng, point.lat])
      },
      properties: {
        diagnosticType: 'segment',
        segmentIndex,
        classification: isolated.has(segmentIndex)
          ? 'isolated-geometric-component'
          : 'shared-endpoint-geometric-component',
        opticalContinuityConfirmed: false,
        style: isolated.has(segmentIndex) ? 'red' : 'blue'
      }
    });
  });

  connectivity.danglingEndpoints.forEach((endpoint, index) => {
    const points = segments[endpoint.owners[0].segmentIndex];
    const point = endpoint.owners[0].end === 'start' ? points[0] : points[points.length - 1];
    features.push({
      type: 'Feature',
      id: 'dangling-' + index,
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        diagnosticType: 'dangling-endpoint',
        segmentIndex: endpoint.owners[0].segmentIndex,
        endpoint: endpoint.owners[0].end,
        style: 'red',
        requiresFieldConfirmation: true,
        opticalContinuityConfirmed: false
      }
    });
  });

  connectivity.junctionCandidates.forEach((junction, index) => {
    const [lat, lng] = junction.coordinate.split(',').map(Number);
    features.push({
      type: 'Feature',
      id: 'junction-' + index,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        diagnosticType: 'junction-candidate',
        degree: junction.degree,
        style: 'amber',
        requiresFieldConfirmation: true,
        opticalContinuityConfirmed: false
      }
    });
  });

  const precision = options.precision === undefined ? 6 : options.precision;
  proximity.forEach((candidate, index) => {
    let point = candidate.point || candidate.projectedPoint;
    if (candidate.kind === 'endpoint-endpoint') {
      const a = candidate.a, b = candidate.b;
      const aPoints = segments[a.segmentIndex], bPoints = segments[b.segmentIndex];
      const aPoint = a.end === 'start' ? aPoints[0] : aPoints[aPoints.length - 1];
      const bPoint = b.end === 'start' ? bPoints[0] : bPoints[bPoints.length - 1];
      const sameCoordinate = aPoint.lat.toFixed(precision) === bPoint.lat.toFixed(precision) &&
        aPoint.lng.toFixed(precision) === bPoint.lng.toFixed(precision);
      if (sameCoordinate) return;
      if (!point) point = midpoint(aPoint, bPoint);
    }
    if (!validPoint(point)) return;
    features.push({
      type: 'Feature',
      id: 'proximity-' + index,
      geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      properties: {
        diagnosticType: 'proximity-candidate',
        candidateKind: candidate.kind,
        distanceMeters: candidate.distanceMeters,
        style: 'amber',
        requiresFieldConfirmation: true,
        opticalContinuityConfirmed: false
      }
    });
  });

  return {
    type: 'FeatureCollection',
    features,
    properties: {
      diagnosticOnly: true,
      method: connectivity.method,
      disconnectedComponentCount: connectivity.disconnectedComponentCount,
      isolatedSegmentCount: connectivity.isolatedSegments.length,
      proximityCandidateCount: features.filter(feature => feature.properties.diagnosticType === 'proximity-candidate').length,
      opticalContinuityConfirmed: false,
      changesOperationalGraph: false
    }
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { buildDiagnosticGeoJSON };
if (typeof window !== 'undefined') window.MKDiagnosticGeoJSON = { buildDiagnosticGeoJSON };
