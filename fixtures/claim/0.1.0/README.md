# Claim 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased [Claim authoring schema](../../../schemas/claim/0.1.0.schema.json) and the state semantics in [PROTOCOL.md](../../../docs/PROTOCOL.md). They contain only synthetic opaque references and bounded descriptive text. They contain no real profile, declaration, correction, evidence, source content, credential, or identity.

Run `npm run schema:check` from the repository root. `valid/` contains one record for each initial Claim state. `invalid/` covers unsupported versions, invented negative knowledge, missing evidence/declaration/correction provenance, adjacency without rationale, state/basis mismatch, project scope without a project reference, and raw evidence fields.

Passing authoring validation does not resolve an evidence reference, derive a claim, apply correction precedence, prove task relevance, or authorize disclosure. The DCP continues to use its separate minimized claim summary.
