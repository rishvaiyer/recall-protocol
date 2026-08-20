# Security

## Data boundary

All names, districts, objects, holders, and incident details are synthetic. Do not put personal, production, customer, or real incident data into this repository or demo.

## Safe defaults

- No credentials are committed or printed.
- No cluster is required to run the demo.
- The MCP-shaped audit route is read-only.
- Claim actions require an explicit `taskId`, `agentId`, and `idempotencyKey`.
- Static serving is allowlisted to three files.
- Request bodies are capped at 100 KB.

## Before production use

Add authentication and authorization, tenant/subject isolation, audit export controls, rate limiting, CSRF protection for browser writes, structured input validation, secret management, TLS, database-backed transactions, and operational monitoring. Treat the current in-memory mode as ephemeral demo state.
