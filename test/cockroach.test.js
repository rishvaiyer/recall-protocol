import test from 'node:test';
import assert from 'node:assert/strict';
import { createCockroachAdapter } from '../src/cockroach.js';

function fakePg({ serializeOnce = false } = {}) {
  const calls = [];
  let serializationPending = serializeOnce;
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT result')) return { rowCount: 0, rows: [] };
      if (sql.startsWith('INSERT INTO recall_task_claims')) {
        if (serializationPending) { serializationPending = false; const error = new Error('retry'); error.code = '40001'; throw error; }
        return { rowCount: 1, rows: [{ task_id: 'task-1' }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() { calls.push('RELEASE'); }
  };
  class Pool {
    async query(sql) { calls.push(sql); return { rowCount: 0, rows: [{ '?column?': 1 }] }; }
    async connect() { return client; }
    async end() { calls.push('END'); }
  }
  return { pgModule: { Pool }, calls };
}

test('Cockroach adapter executes a serializable durable claim', async () => {
  const fake = fakePg();
  const adapter = await createCockroachAdapter('postgresql://synthetic', { pgModule: fake.pgModule });
  const result = await adapter.claimTask({ taskId: 'task-1', agentId: 'resident-imani', idempotencyKey: 'request-1' });
  assert.equal(result.status, 'claimed');
  assert.equal(result.backend, 'cockroachdb');
  assert.ok(fake.calls.includes('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'));
  assert.ok(fake.calls.includes('COMMIT'));
});

test('Cockroach adapter retries a serialization failure with a fresh transaction', async () => {
  const fake = fakePg({ serializeOnce: true });
  const adapter = await createCockroachAdapter('postgresql://synthetic', { pgModule: fake.pgModule, maxRetries: 2 });
  const result = await adapter.claimTask({ taskId: 'task-1', agentId: 'resident-imani', idempotencyKey: 'request-1' });
  assert.equal(result.status, 'claimed');
  assert.equal(fake.calls.filter((call) => call === 'BEGIN').length, 2);
  assert.ok(fake.calls.includes('ROLLBACK'));
});
