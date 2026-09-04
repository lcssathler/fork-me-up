# DCP 0.1.0 synthetic fixture corpus

These fixtures exercise the unreleased [DCP authoring schema](../../../schemas/dcp/0.1.0.schema.json) and [contract limits](../../../docs/PROTOCOL.md#42-draft-limits-and-validation-scope). They contain no real developer profile, credential, repository evidence, or client integration. All claims and references are synthetic.

Run `npm run schema:check` from the repository root. It is also part of `npm run check` and the existing Windows CI job. Each directory must be non-empty; malformed JSON, unexpected entries, or a changed expected outcome fails the check. Files are limited to 65,536 bytes, each group to 32 files, and packet content to its declared compact UTF-8 budget. The checker accepts no file arguments and prints no fixture content or filename.

| Fixture | Expected | Coverage |
|---|---|---|
| `valid/minimal.json` | Accept | Empty claim/evidence projection with explicit task, policy, budget and expiry. |
| `valid/insufficient-evidence.json` | Accept | Exact protocol example; missing evidence does not assert ignorance. |
| `valid/claim-states.json` | Accept | All five states, compact rationale/correction, stale evidence and synthetic consumer identifiers. No remote authorization is implied. |
| `invalid/missing-purpose.json` | Reject | Missing required purpose. |
| `invalid/unsupported-version.json` | Reject | Unsupported exact authoring version. |
| `invalid/invalid-claim-state.json` | Reject | Forbidden `does-not-know` state. |
| `invalid/raw-evidence.json` | Reject | Raw-evidence property carrying an explicit synthetic canary. |
| `invalid/unsafe-policy.json` | Reject | Free-form instruction property carrying the same synthetic canary. |

Unit tests add field/type/cardinality limits, calendar/order/byte boundaries, non-mutation, unsafe references, malformed UTF-8/JSON, missing corpus, and junction/symlink rejection. The canary is deliberately synthetic, not a credential. Additional tests show that instruction-like free text can remain structurally valid and does not modify policy during validation; this is not proof of redaction or safe model behavior.

M0-S08 traces to `FMU-FR-009`, `FMU-NFR-009`, and `FMU-NFR-011`. No behavioral evaluation is claimed. Consumer unknown-field compatibility, full provider conformance, runtime disclosure controls, and MCP integration remain separate gates.
