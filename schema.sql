-- CockroachDB-compatible durable model. The demo runs without a cluster secret
-- using the deterministic in-memory fallback; DATABASE_URL/CockroachDB_URL can
-- be wired to this schema without changing the incident contracts.
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY,
  code STRING NOT NULL,
  title STRING NOT NULL,
  severity STRING NOT NULL,
  status STRING NOT NULL,
  notice STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY,
  incident_id UUID NULL REFERENCES incidents (id),
  name STRING NOT NULL,
  batch STRING NOT NULL,
  district STRING NOT NULL,
  description STRING NOT NULL,
  holder_id UUID NOT NULL,
  status STRING NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_ledger (
  id UUID PRIMARY KEY,
  incident_id UUID NULL REFERENCES incidents (id),
  type STRING NOT NULL,
  actor_id UUID NOT NULL,
  summary STRING NOT NULL,
  metadata JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_claims (
  task_id STRING PRIMARY KEY,
  agent_id UUID NOT NULL,
  object_id UUID NULL,
  action STRING NOT NULL,
  status STRING NOT NULL,
  checkpoint STRING NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key STRING PRIMARY KEY,
  task_id STRING NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS objects_batch_idx ON objects (batch);
CREATE INDEX IF NOT EXISTS event_ledger_incident_time_idx ON event_ledger (incident_id, occurred_at DESC);
