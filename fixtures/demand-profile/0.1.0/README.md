# Demand Profile 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased public [Demand Profile schema](../../../schemas/demand-profile/0.1.0.schema.json). They use only synthetic opaque identifiers and bounded task metadata; no real task, repository, source content, path, profile, credential, grant, or identity is present.

Run `npm run schema:check`. Valid fixtures cover uncertain, task-only, and task-plus-project demand. Invalid fixtures cover versions, missing task context, duplicate/invalid capability bases, metadata availability, prohibited raw or policy-bearing fields, and a DCP envelope. Passing authoring validation does not prove source authorization, task relevance, derivation, redaction, profile intersection, or DCP compilation.
