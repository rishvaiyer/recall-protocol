// Optional CockroachDB adapter. It is loaded only when COCKROACHDB_URL or
// DATABASE_URL is supplied; the public demo remains usable without a cluster.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS recall_task_claims (task_id STRING PRIMARY KEY, agent_id STRING NOT NULL, object_id STRING, action STRING NOT NULL, status STRING NOT NULL, checkpoint STRING NOT NULL, claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS recall_idempotency (key STRING PRIMARY KEY, task_id STRING NOT NULL, result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS recall_event_ledger (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type STRING NOT NULL, actor_id STRING NOT NULL, summary STRING NOT NULL, metadata JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS recall_task_claims_active ON recall_task_claims (task_id) WHERE status IN ('claimed','interrupted');`;

export async function createCockroachAdapter(connectionString) {
  let pg;
  try { pg = await import('pg'); } catch { return { unavailable: true, reason: 'pg-driver-not-installed' }; }
  const pool = new pg.default.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3, idleTimeoutMillis: 10_000 });
  try { await pool.query('SELECT 1'); for (const statement of SCHEMA.split(';').map((item) => item.trim()).filter(Boolean)) await pool.query(statement); } catch (error) { await pool.end(); return { unavailable: true, reason: `cockroach-connect-failed: ${error.message}` }; }
  return {
    storageMode: 'cockroachdb-serializable',
    async claimTask({ taskId, agentId, idempotencyKey, action = 'warn', objectId }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN'); await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        const replay = await client.query('SELECT result FROM recall_idempotency WHERE key=$1', [idempotencyKey]);
        if (replay.rowCount) { await client.query('COMMIT'); return { ...replay.rows[0].result, replayed: true, backend: 'cockroachdb' }; }
        const inserted = await client.query(`INSERT INTO recall_task_claims(task_id,agent_id,object_id,action,status,checkpoint) VALUES($1,$2,$3,$4,'claimed','claim-accepted') ON CONFLICT (task_id) DO NOTHING RETURNING task_id`, [taskId, agentId, objectId || null, action]);
        const result = inserted.rowCount ? { ok: true, status: 'claimed', taskId, agentId, checkpoint: 'claim-accepted', message: 'Task transactionally claimed.', backend: 'cockroachdb' } : { ok: false, status: 'conflict', taskId, message: 'Task already has a durable owner.', backend: 'cockroachdb' };
        await client.query('INSERT INTO recall_idempotency(key,task_id,result) VALUES($1,$2,$3)', [idempotencyKey, taskId, JSON.stringify(result)]); await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); if (error.code === '40001') return this.claimTask({ taskId, agentId, idempotencyKey, action, objectId }); throw error; } finally { client.release(); }
    },
    async audit() { const result = await pool.query('SELECT id,type,actor_id,summary,metadata,occurred_at FROM recall_event_ledger ORDER BY occurred_at DESC,id DESC LIMIT 30'); return { readOnly: true, source: 'cockroachdb-event-ledger', results: result.rows }; },
    async close() { await pool.end(); }
  };
}
