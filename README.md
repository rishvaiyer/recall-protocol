# Recall Protocol

Recall Protocol is a small, synthetic multi-agent incident-memory demo. A new Moonfire Lantern safety notice travels across three districts while resident agents coordinate warning, quarantine, and retrieval work.

It demonstrates the part of agentic memory that ordinary chat history misses:

- durable event and ownership ledgers;
- serializable-style task claims with one winner;
- idempotency-key replay without duplicate work;
- interruption recovery from a saved checkpoint;
- deterministic related-item recall (token intersection, with vector retrieval intentionally optional);
- a read-only `recall.audit` MCP-shaped endpoint;
- a graceful in-memory fallback when no CockroachDB cluster secret is present.

## Run locally

Requires Node 20+ and no database.

```bash
npm test
npm run smoke
npm start
```

Open `http://localhost:4319`. Click **Run recall sequence** to see the incident, a replay-safe retry, a claim conflict, and an interrupted task recover into the event ledger. The UI has no personal or production data.

## CockroachDB path

`schema.sql` is the durable CockroachDB-compatible model. It uses `STRING`, `UUID`, `TIMESTAMPTZ`, `JSONB`, foreign keys, and indexes that are supported by CockroachDB. When `COCKROACHDB_URL` or `DATABASE_URL` is present, `src/cockroach.js` initializes the durable tables and routes claim/idempotency and audit operations through `pg`.

The adapter wraps claim creation and idempotency insertion in a serializable transaction, enforces `task_id` and idempotency uniqueness at the database layer, retries bounded `40001` serialization failures, recovers concurrent idempotency races, and reads events with an explicit `ORDER BY occurred_at DESC, id`. Local and the current public Railway demo use the clearly labeled `memory-fallback (no cluster secret)` because no paid CockroachDB resource was provisioned.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/state` | Fixture, claims, ownership, and event ledger snapshot |
| `POST /api/demo/run` | Reset and run the deterministic incident sequence |
| `POST /api/demo/reset` | Restore the initial fixture |
| `GET /api/audit?q=claim` | Read-only event search |
| `GET /api/mcp/audit` | Read-only MCP-shaped incident audit |
| `POST /api/claims` | Idempotent task claim contract |

## Deployment

The app is designed for a free/dev Railway service. Set `PORT` only for the synthetic fallback. To exercise durable claims against a user-owned free/dev CockroachDB cluster, set its sealed connection string as `COCKROACHDB_URL`; never put it in the browser or repository.

## Boundaries

This is a hackathon/demo slice, not a safety system. It does not contact residents, send notices, operate a real recall, provide legal/medical advice, or claim exactly-once distributed execution. See [SECURITY.md](SECURITY.md), [THREAT_MODEL.md](THREAT_MODEL.md), and [HANDOFF.md](HANDOFF.md).
