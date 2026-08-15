import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { clampPosition, createGraphModel, getNodeDetail, nodeMatchesFilter, nudgePosition } from '../public/graph-model.js';

test('graph positions stay inside the touch-safe canvas and keyboard nudges are bounded', () => {
  assert.deepEqual(clampPosition({ x: -20, y: 999 }), { x: 70, y: 500 });
  assert.deepEqual(nudgePosition({ x: 830, y: 60 }, 12, -12), { x: 830, y: 60 });
  assert.deepEqual(nudgePosition({ x: 220, y: 205 }, 12, 0), { x: 232, y: 205 });
});

test('graph model keeps the incident, M-17 objects, tasks, and labeled links visible before recall runs', () => {
  const snapshot = createStore().snapshot();
  const graph = createGraphModel(snapshot);
  assert.equal(graph.nodes.filter((node) => node.type === 'object').length, 4);
  assert.equal(graph.nodes.filter((node) => node.type === 'task').length, 3);
  assert.ok(graph.edges.every((edge) => edge.label));
  assert.ok(graph.edges.some((edge) => edge.label === 'held by'));
});

test('filters reflect claims and conflicts after the deterministic demo', () => {
  const snapshot = createStore().runDemo();
  const graph = createGraphModel(snapshot);
  const claimed = graph.nodes.filter((node) => nodeMatchesFilter(snapshot, node, 'claimed'));
  const conflicts = graph.nodes.filter((node) => nodeMatchesFilter(snapshot, node, 'conflicts'));
  assert.ok(claimed.some((node) => node.type === 'task'));
  assert.ok(conflicts.some((node) => node.id === 'task-warn-02'));
  assert.equal(snapshot.lastRun.interruptionRecovered, true);
});

test('object inspector explains holder, status, and why the node is linked', () => {
  const snapshot = createStore().runDemo();
  const graph = createGraphModel(snapshot);
  const object = graph.nodes.find((node) => node.id === 'lantern-m17-03');
  const detail = getNodeDetail(snapshot, object);
  assert.equal(detail.fields.find(([label]) => label === 'Status')[1], 'recovered');
  assert.ok(detail.why.length > 20);
  assert.ok(detail.history.some((entry) => entry.includes('checkpoint')));
});
