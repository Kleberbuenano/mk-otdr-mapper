/* Graph path engine shared by the browser app and Node regression tests. */
(function (root) {
  'use strict';

  function shortestPath(graph, start, end, bannedEdge) {
    if (start == null || end == null || !graph || !graph.adj || !graph.nodes) return null;
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const open = [[0, start]];

    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [distance, current] = open.shift();
      if (distance !== dist.get(current)) continue;
      if (current === end) break;

      for (const edge of graph.adj.get(current) || []) {
        if (bannedEdge &&
          ((current === bannedEdge[0] && edge.to === bannedEdge[1]) ||
           (current === bannedEdge[1] && edge.to === bannedEdge[0]))) continue;
        const nextDistance = distance + edge.w;
        if (nextDistance < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, nextDistance);
          prev.set(edge.to, current);
          open.push([nextDistance, edge.to]);
        }
      }
    }

    if (!dist.has(end)) return null;
    const keys = [];
    for (let node = end; node != null; node = prev.get(node)) {
      keys.push(node);
      if (node === start) break;
    }
    keys.reverse();
    return { points: keys.map(key => graph.nodes.get(key)), distance: dist.get(end), keys };
  }

  const api = { shortestPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MKRouteEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
