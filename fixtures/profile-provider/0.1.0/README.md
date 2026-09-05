# Profile Provider 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased public [Profile Provider capabilities schema](../../../schemas/profile-provider/0.1.0.schema.json). They contain only synthetic opaque identifiers and bounded capability metadata; they reveal no real provider, profile existence, repository, credential, task, or identity.

Run `npm run schema:check`. Valid fixtures cover a complete local provider and a remote managed subset. Invalid fixtures cover versions, mandatory capability discovery, duplicates, task-context disclosure, credentials, and client-specific fields. Passing authoring validation does not prove implementation, authorization, transport, or consumer conformance.
