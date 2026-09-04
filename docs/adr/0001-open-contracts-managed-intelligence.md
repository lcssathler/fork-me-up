# ADR-0001: Open contracts and managed intelligence

- Status: Accepted
- Date: 2026-09-04

## Context

Fork Me Up is intended to be a credible public portfolio project and a useful community tool while also supporting a sustainable paid product. Closing the profile format or shipping a non-functional public shell would limit adoption, trust, portability, and third-party integrations. Publishing every managed inference and operations component would make the initial commercial boundary harder for a solo project to sustain.

## Decision

Fork Me Up uses the following boundary:

- The Developer Context Protocol, schemas, SDKs, conformance fixtures, Community runtime, basic deterministic provider, local MCP server, and reference adapters are public and useful without Cloud.
- Independent providers may create and consume conforming profiles and DCPs.
- Fork Me Up Cloud may remain proprietary and charge for managed source connectivity, deeper multi-repository compilation, continuous refresh, secure storage, review history, authenticated remote delivery, auditability, quotas, support, and service levels.
- The developer owns their profile data and can inspect, correct, export, and delete it. Paid access does not gate the right to use the open format.
- Apache-2.0 is adopted for public repository content because permissive adoption and an express patent grant support commercial clients and harnesses. [ADR-0004](0004-apache-license-and-trademark-policy.md) records the final license, ownership, and notice decision.
- The Fork Me Up name and visual identity are governed separately from the code license by the root trademark policy.

## Consequences

### Positive

- Community users receive a real local product rather than an integration stub.
- Clients can adopt the protocol without depending on the hosted service.
- The public repository demonstrates product, protocol, security, and engineering quality.
- Commercial value is tied to depth, freshness, trust, and operations rather than format lock-in.

### Negative

- A permissive public runtime can be reused by competitors.
- Public and private repositories or workspaces require a disciplined dependency boundary.
- Protocol compatibility and conformance become long-term maintenance commitments.
- Apache-2.0 compliance and the separate trademark boundary must be preserved in public code, packages, and documentation.

## Rejected alternatives

- **Closed protocol:** rejected because it blocks portability and ecosystem adoption.
- **Public shell requiring Cloud:** rejected because it is not a credible open product.
- **Publish the entire hosted implementation immediately:** rejected because it expands security, operations, support, and business scope before validation.
- **Strong copyleft for every integration surface:** deferred because it may create friction for the commercial clients the protocol is intended to reach.

## Validation

This decision is successful when Community completes the full local value loop, an independent provider can implement the protocol, and users still choose to pay for managed quality and delivery.
