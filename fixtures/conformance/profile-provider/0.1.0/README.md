# Profile Provider conformance 0.1.0 synthetic fixture corpus

These public fixtures exercise the unreleased [Profile Provider conformance transcript schema](../../../../schemas/conformance/profile-provider/0.1.0.schema.json) and [Provider contract](../../../../schemas/profile-provider/0.1.0.schema.json). They contain only synthetic, bounded exchanges and no real provider, profile, repository, credential, task, source content, or identity.

Run `npm run schema:check`. Valid fixtures cover all four read operations, safe extensions, typed failure, and an explicitly unsupported subset operation. Invalid fixtures cover versions, request correlation, unadvertised success, unsafe errors, and unnamespaced extensions. Passing these development fixtures does not establish runtime, transport, authorization, MCP, or cross-client behavioral conformance.
