# Versioning policy

This policy applies the existing [protocol compatibility rules](docs/PROTOCOL.md#12-compatibility) and [engineering process](docs/ENGINEERING.md) to repository changes. It does not release a schema, select a package publication schedule, or authorize publishing.

## Development status and version boundaries

The private root workspace is versioned `0.0.0` as a development placeholder and remains non-publishable. The protocol document's `0.1` label and illustrative packet are unreleased drafts, not a released schema or compatibility claim. M0-S08 through M0-S12 prepare the draft contracts and fixtures; runnable behavior and releases have separate roadmap gates.

Keep these versions distinct:

| Item | Meaning |
|---|---|
| Package version | Identifies a particular package/API release. Each published artifact must state its version and supported schema versions. |
| Public schema version | Identifies the exchanged contract and its compatibility rules; it need not equal a package version. |
| Internal store schema version | Identifies a provider's private storage and migration format; it is not a public interchange contract. |
| Profile revision or `profileVersion` | Identifies profile state for freshness and consistency; it is not a package or schema release number. |
| Document draft version | Tracks a specification draft and does not imply runtime support. |

Do not increment the root placeholder for each documentation slice or convert existing draft labels in a governance-only change. Draft changes must still be explicit and synchronize affected examples and fixtures. The first release must assign full semantic versions and identify the exact supported public contracts.

## Released packages and public contracts

Released packages and schemas use [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Declare the public API before releasing it. For stable package APIs, use a major increment for incompatibility, a minor increment for compatible additions or deprecations, and a patch increment for compatible fixes. Label any prerelease explicitly; do not present it as a stable release. Published artifacts are immutable: a fix requires a new version.

The protocol's stricter compatibility obligations apply to every released public schema, including a released `0.x.y` schema:

- Reject unsupported major versions safely.
- Within a supported major, consumers ignore unknown optional fields unless a capability declaration specifies otherwise.
- Do not remove required fields or change their meaning within a major. An incompatible public contract change requires a new major and explicit migration or rejection behavior; a `0.x` label is not permission to weaken that rule.
- Use minor versions for compatible optional additions and patch versions for compatible corrections. Treat changed validation or accepted inputs as compatibility changes, even when described as a bug fix.
- Never downgrade authorization, disclosure, correction precedence, or provenance to negotiate a version.

An unreleased draft can evolve, but it must remain clearly labeled and must not be used to claim conformance to an untested contract. A package update does not silently migrate profile data or make an unsupported schema acceptable.

## Change and migration evidence

For a public contract change, update schemas, generated types where present, valid and invalid synthetic fixtures, examples, compatibility notes, migrations, the [changelog](CHANGELOG.md), and conformance tests together. Record affected consumers/providers and coordinate shared contract ownership before implementation.

Compatibility tests must cover supported and unsupported versions, unknown optional fields, and safe failure. Storage and import/export changes must document the source and target versions, user action, recovery path, and behavior when migration is unavailable or fails. Preserve corrections and provenance, validate before activating new state, and retain prior valid state on failure. Canonical private storage, Portable Profile Export, and a DCP remain distinct boundaries.

Document deprecations and the intended replacement before removal; removal must respect the applicable major-version rule. Do not promise a support window or automatic migration that has not been implemented and tested. Current release-support status belongs in [SECURITY.md](SECURITY.md).

## Release preparation

Record unreleased work under `Unreleased` in the changelog. An authorized release replaces the relevant pending entries with the actual version and release date, describes breaking changes and migration steps, and points to verified source and artifacts. Do not manufacture release history from milestone completions.

Run the current [verification path](CONTRIBUTING.md#local-setup-and-verification) and every additional applicable [release gate](docs/ENGINEERING.md#84-release-gate), including clean protected source, artifact inspection, license report, SBOM, checksums, and provenance/signing where supported. Passing the baseline alone is not release approval. Tags, package publication, GitHub Releases, and deployment require separate explicit authorization and their roadmap gates. M0's repository visibility transition is not a product release.
