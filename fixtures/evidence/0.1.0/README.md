# Evidence 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased [Evidence authoring schema](../../../schemas/evidence/0.1.0.schema.json) and the contract semantics in [PROTOCOL.md](../../../docs/PROTOCOL.md). They contain only synthetic opaque references and metadata. They contain no real developer identity, repository name, source content, credential, or path.

Run `npm run schema:check` from the repository root. The command checks every draft contract through the existing local/CI aggregate, accepts no path argument, bounds fixture files and counts, rejects symlink/junction traversal, and emits only fixed counts or a fixed failure message.

`valid/` covers unknown, attributable, and coauthored observations. `invalid/` covers unsupported versions, observation/claim confusion, unsafe source references, inconsistent authorship, invalid time ordering, and missing invalidation provenance. Passing authoring validation does not verify source authorization, repository existence, authorship, redaction, or evidence quality.
