# Threat model

| Threat | Current mitigation | Remaining gap |
| --- | --- | --- |
| Duplicate agent retry | Idempotency map returns the original result | Map is process-local until a DB adapter is wired |
| Two agents claim one task | One in-memory winner and explicit conflict event | CockroachDB serializable transaction is represented by contract, not exercised here |
| Agent interruption | Checkpoint is retained and recovery is recorded | No lease expiry or heartbeat timer |
| Cross-tenant recall leakage | Synthetic single-tenant fixture only | Tenant/subject predicates must be mandatory in production queries |
| Unauthorized mutation through audit | Audit and MCP routes have no writes | Add auth, signed tool identity, and authorization policy |
| Prompt or fixture poisoning | No LLM or remote retrieval is used | Validate and version external inputs before enabling vector/LLM paths |
| Secret exposure | No secret is needed or logged | Railway secret and Cockroach TLS handling still require deployment review |

The most important correctness rule is that authority and uniqueness must be enforced by the database transaction and schema constraints, not by an agent prompt or UI state.
