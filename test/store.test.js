import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('fixture has three residents, three districts, and twelve objects', () => {
  const state = createStore().snapshot();
  assert.equal(state.residents.length, 3);
  assert.equal(state.districts.length, 3);
  assert.equal(state.objects.length, 12);
});

test('deterministic recall links only the M-17 batch', () => {
  const store = createStore();
  const state = store.runDemo();
  assert.equal(state.related.length, 4);
  assert.deepEqual(state.related.map((item) => item.objectId).sort(), ['lantern-m17-01', 'lantern-m17-02', 'lantern-m17-03', 'lantern-m17-04']);
});

test('idempotency replay does not create a duplicate claim', () => {
  const store = createStore();
  const first = store.claimTask({ taskId: 'warn:one', agentId: 'resident-imani', idempotencyKey: 'same-key' });
  const second = store.claimTask({ taskId: 'warn:one', agentId: 'resident-imani', idempotencyKey: 'same-key' });
  assert.equal(first.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(store.snapshot().claims.length, 1);
});

test('transactional claim conflict has one winner', () => {
  const store = createStore();
  const winner = store.claimTask({ taskId: 'retrieve:one', agentId: 'resident-imani', idempotencyKey: 'a' });
  const loser = store.claimTask({ taskId: 'retrieve:one', agentId: 'resident-tomas', idempotencyKey: 'b' });
  assert.equal(winner.ok, true);
  assert.equal(loser.status, 'conflict');
  assert.equal(store.snapshot().claims.filter((item) => item.taskId === 'retrieve:one').length, 1);
});

test('demo records interruption and recovery evidence', () => {
  const state = createStore().runDemo();
  assert.equal(state.lastRun.interruptionRecovered, true);
  assert.ok(state.events.some((item) => item.type === 'claim.interrupted'));
  assert.ok(state.events.some((item) => item.type === 'claim.recovered'));
  assert.equal(state.objects.find((item) => item.id === 'lantern-m17-03').status, 'recovered');
});

test('MCP audit is read-only and names unresolved holders', () => {
  const store = createStore();
  store.runDemo();
  const result = store.mcpAudit({ question: 'Which M-17 lanterns remain?' });
  assert.equal(result.readOnly, true);
  assert.equal(result.affected.length, 4);
  assert.ok(result.answer.includes('remain in circulation'));
});
