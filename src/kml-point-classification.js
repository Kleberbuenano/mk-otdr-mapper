'use strict';

/**
 * Separates KML Point placemarks without assigning meaning to unknown names.
 * Classification preserves the app's existing CEO and SITE/PT naming rules.
 */
function classifyKmlPoints(points) {
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  const boxes = [];
  const sites = [];
  const genericPoints = [];
  for (const point of points) {
    if (!point || typeof point.name !== 'string' ||
        !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    if (/(^|\s)CEO(\s|$)/i.test(point.name)) {
      boxes.push({
        ...point,
        concentrator: /CEO\s*0?3(?:\D|$)/i.test(point.name)
      });
    } else if (/^(SITE|PT\s*\d+|PT\d+)/i.test(point.name)) {
      sites.push(point);
    } else {
      genericPoints.push(point);
    }
  }
  return { boxes, sites, genericPoints };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classifyKmlPoints };
}
if (typeof window !== 'undefined') {
  window.MKKmlPointClassification = { classifyKmlPoints };
}
