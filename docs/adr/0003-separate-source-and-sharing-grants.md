# ADR-0003: Separate source access from context sharing

- Status: Accepted
- Date: 2026-09-04

## Context

Fork Me Up may read developer-selected repositories to construct a private profile and may later deliver a minimized DCP to an external consumer. These are different actions, actors, purposes, credentials, and risks. Treating one consent as authority for the other would create excessive disclosure and confused-deputy risk.

## Decision

- Community is local-first and requires no hosted account.
- A future managed source connector requires a Source Grant scoped to an explicit provider and repository set.
- A future external consumer requires a separate Sharing Grant scoped to a consumer, purpose, disclosure class, scopes, and duration.
- Revoking a Sharing Grant blocks subsequent calls within a documented enforcement SLA without silently changing the source connection. It cannot retrieve a DCP already delivered; consent discloses this and packets use short TTLs.
- Source revocation offers `disconnect`, which stops new collection and marks affected derived data stale according to retention policy, and `disconnect-and-delete`, which removes derived evidence, claims, caches, and scheduled refresh, recompiles the profile, and follows documented backup deletion. Existing Sharing Grants are re-evaluated.
- Upstream source credentials and downstream consumer credentials are stored, validated, and rotated separately and are never passed through.
- The commercial MLP supports selected GitHub repositories only. Google Workspace and broad personal-data sources remain deferred behind a new hypothesis, ADR, and threat review.
- Authorization, isolation, schema validation, and redaction fail closed. Availability may degrade by returning no Fork Me Up context while ordinary host work continues.

## Consequences

### Positive

- Developers can understand and revoke each data flow independently.
- Consumers receive only purpose-bound context rather than source access.
- Token audience and provider boundaries remain clear.
- New source and consumer integrations can evolve independently.

### Negative

- Cloud requires two consent models and more audit state.
- Disconnect and deletion semantics must be documented carefully.
- Clients with limited authentication support may require an open local bridge or manual export.

## Validation

Before remote delivery, negative tests must prove that source access does not imply consumer access, consumer tokens cannot reach source providers, revoked or under-scoped grants return no protected data, and a client cannot select another developer by identifier.


