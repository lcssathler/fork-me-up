# Community Profile Store 0.1.0 synthetic fixture corpus

These fixtures exercise the reference provider's implementation-internal [Community Profile Store schema](../../../../schemas/internal/community-profile-store/0.1.0.schema.json). The schema is visible for review but is not a public interchange contract. Fixtures contain only synthetic opaque identifiers and metadata.

Run `npm run schema:check`. Valid fixtures cover empty and populated private state. Invalid fixtures cover versions, sensitive fields, the public export envelope, missing internal state, timestamp ordering, and dangling provenance. Passing authoring validation does not implement atomic writes, migrations, recovery, export, or deletion.
