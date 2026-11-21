const test = require('node:test');
const assert = require('node:assert/strict');
const { shortestPath } = require('../dist/route-engine.js');

function graph(edges) {
  const nodes = new Map();
  const adj = new Map();
  for (const [a, b, w] of edges) {
    for (const key of [a, b]) {
      if (!nodes.has(key)) nodes.set(key, { id: key });
      if (!adj.has(key)) adj.set(key, []);
    }
    adj.get(a).push({ to: b, w });
    adj.get(b).push({ to: a, w });
  }
  return { nodes, adj };
}

test('escolhe o menor caminho entre PT09 e a CEO', () => {
  const g = graph([['PT09','A',2],['A','CEO',2],['PT09','B',1],['B','CEO',8]]);
  const path = shortestPath(g, 'PT09', 'CEO');
  assert.deepEqual(path.keys, ['PT09','A','CEO']);
  assert.equal(path.distance, 4);
});

test('bloqueia a primeira aresta da Rota 01 e encontra alternativa real', () => {
  const g = graph([['PT09','A',2],['A','CEO23',2],['PT09','B',3],['B','CEO23',3],['CEO23','DEST',1]]);
  const route01 = shortestPath(g, 'PT09', 'DEST');
  const alternative = shortestPath(g, 'PT09', 'DEST', [route01.keys[0], route01.keys[1]]);
  assert.deepEqual(route01.keys, ['PT09','A','CEO23','DEST']);
  assert.deepEqual(alternative.keys, ['PT09','B','CEO23','DEST']);
  assert.equal(alternative.distance, 7);
});

test('retorna null quando só existe a Rota 01 e sua primeira aresta é bloqueada', () => {
  const g = graph([['PT09','A',2],['A','CEO23',2],['CEO23','DEST',1]]);
  const route01 = shortestPath(g, 'PT09', 'DEST');
  const alternative = shortestPath(g, 'PT09', 'DEST', [route01.keys[0], route01.keys[1]]);
  assert.equal(alternative, null);
});

test('retorna null quando o destino está desconectado', () => {
  const g = graph([['PT09','A',2],['X','DEST',1]]);
  assert.equal(shortestPath(g, 'PT09', 'DEST'), null);
});
