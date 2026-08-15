# Handoff

## Verified slice

- Independent repository: `recall-protocol`.
- Synthetic fixture: 3 residents, 3 districts, 12 objects, one M-17 incident.
- `npm test` covers fixture shape, deterministic recall, idempotency, claim conflict, interruption recovery, and read-only audit.
- `npm run smoke` exercises health, state, demo execution, and MCP audit over HTTP.
- No Docker, local database, personal data, Thirdwurld production code, or portfolio files are used.

## Exact next action

If this is submitted to the CockroachDB hackathon, wire a tested adapter against a disposable CockroachDB cluster, add an AWS service with a meaningful bounded role, and capture a short demo video. Keep the in-memory path as a graceful no-secret fallback.

## Known limitations

- The current store is process-local and resets on restart.
- The CockroachDB schema is provided, but the adapter is intentionally not included in this lightweight demo.
- No vector index or LLM is used; recall is deterministic token intersection for reproducibility.
- The MCP endpoint is MCP-shaped HTTP audit, not a full MCP server transport.
- Claim recovery is scripted for the demo and has no lease expiration worker.
