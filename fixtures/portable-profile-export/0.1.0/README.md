# Portable Profile Export 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased public [Portable Profile Export schema](../../../schemas/portable-profile-export/0.1.0.schema.json). They use only synthetic opaque identifiers and metadata; no real profile, repository, credential, path, source content, grant, or identity is present.

Run `npm run schema:check`. Valid fixtures cover empty and populated owner-controlled exports. Invalid fixtures cover versions, sensitive/internal fields, required exclusions, the internal-store envelope, and dangling provenance. Passing authoring validation does not prove owner intent, redaction, migration, persistence, or a successful export.
