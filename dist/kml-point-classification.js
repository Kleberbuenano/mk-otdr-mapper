'use strict';
/* Browser copy of src/kml-point-classification.js. */
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
window.MKKmlPointClassification = { classifyKmlPoints };
