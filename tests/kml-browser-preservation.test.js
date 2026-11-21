const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');

test('browser loads the KML point classifier before application startup', () => {
  assert.match(html, /<script src="\.\/kml-point-classification\.js"><\/script>/);
});

test('KML parser retains generic point placemarks and their descriptions', () => {
  assert.match(html, /description=pm\.getElementsByTagNameNS\('\*','description'\)\[0\]/);
  assert.match(html, /genericPoints:classified\.genericPoints/);
  assert.match(html, /genericPoints=parsed\.genericPoints\|\|\[\]/);
});

test('generic KML points are included in map bounds and visible as unclassified markers', () => {
  assert.match(html, /\.\.\.sites,\.\.\.genericPoints/);
  assert.match(html, /Ponto KML não classificado/);
  assert.match(html, /genericPointLayer=L\.layerGroup\(\)\.addTo\(leafletMap\)/);
  assert.match(html, /addTo\(genericPointLayer\)/);
});

test('generic KML points survive project history and KML export', () => {
  assert.match(html, /JSON\.stringify\(\{routeSegments,ceos,sites,genericPoints\}\)/);
  assert.match(html, /genericPoints=state\.genericPoints\|\|\[\]/);
  assert.match(html, /const genericMarks=genericPoints\.map/);
  assert.match(html, /siteMarks\+genericMarks\+marks/);
});
