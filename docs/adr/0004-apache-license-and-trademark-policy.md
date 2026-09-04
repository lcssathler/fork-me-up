# ADR-0004: Adopt Apache-2.0 and a separate trademark policy

- Status: Accepted
- Date: 2026-09-04

## Context

ADR-0001 established that Fork Me Up would publish open contracts and a useful Community runtime while keeping a separately operated Cloud/Pro implementation proprietary. It named Apache-2.0 as the public-code candidate and required owner review before public code or packages could be released.

The project now needs a final license and trademark decision so that contributors and adopters can understand their rights before implementation begins. The owner, Lucas Sathler de Aguiar Policarpo, confirmed authority to license the current project content and explicitly accepted the commercial reuse, modification, redistribution, patent, notice, and attribution implications of Apache-2.0.

A preliminary name review found no exact `Fork Me Up` result in the consulted USPTO index or exact package identifiers in the consulted npm and PyPI registries. INPI and WIPO searches were not completed because their dynamic interfaces could not be verified in the review environment. The owner accepted that residual risk and authorized continued use of the name. This is not a representation that a Project Mark is available, registered, or free from third-party rights.

## Decision

- Content distributed from this public repository is licensed under the unmodified Apache License 2.0 unless a file explicitly states otherwise. This includes the protocol, schemas, SDKs, Community runtime, deterministic basic provider, local MCP server, reference adapters, examples, conformance tests, and project documentation.
- The root `NOTICE` identifies Lucas Sathler de Aguiar Policarpo as the copyright holder for the initial work. The project requires no copyright assignment by default. Copyright in later contributions remains with the applicable copyright holder; accepted Contributions are licensed under Apache-2.0 unless the copyright holder conspicuously designates a submission as `Not a Contribution` or a separate written agreement applies.
- Generated developer profiles, Developer Context Packets, user evidence, and other user-owned data are not project repository content and are not relicensed merely because the software processes them.
- Cloud/Pro source code and operations remain outside the public repository in a separately controlled repository or workspace and may stay proprietary. Public packages must not import proprietary modules.
- The Fork Me Up name and official visual identity are governed by the root `TRADEMARKS.md`. The code license does not grant trademark rights beyond its own terms.
- Factual, non-confusing references to origin, compatibility, and derivation are permitted. Modified distributions use their own primary name and identity. Uses that imply an official relationship or place a Project Mark in product, service, package, domain, account, event, certification, merchandise, or logo branding require written permission unless applicable law permits them independently.

## Consequences

### Positive

- Community users and commercial adopters receive broad, explicit copyright and patent permissions.
- The public implementation remains usable without an account, proprietary service, or paid license.
- The project name and identity remain distinguishable from the reusable public code.
- The Community/Cloud boundary remains based on separate code and operations rather than a closed protocol.

### Negative

- Competitors may use, modify, redistribute, and commercially exploit the public work, including in proprietary products that comply with Apache-2.0.
- Redistributors must satisfy the license's notice, modification, attribution, and `NOTICE` obligations.
- External contributions do not automatically transfer copyright to the project owner, which can constrain a future relicensing decision.
- The preliminary name review does not eliminate trademark risk, particularly because INPI, WIPO, relevant classes, territories, and unregistered prior uses were not exhaustively reviewed.

## Rejected alternatives

- **MIT:** rejected for this project because its shorter notice obligation does not provide Apache-2.0's express patent grant and defensive termination or its express trademark boundary.
- **Strong copyleft:** rejected for the initial public integration surfaces because it would add adoption constraints inconsistent with ADR-0001's interoperability decision.
- **Custom source-available terms:** rejected because Community must be open, portable, and usable commercially without a proprietary license.
- **Delay the decision until release:** rejected because M0 requires rights and ownership implications to be explicit before public code is developed or published.

## Preliminary review record

The September 4, 2026 review used exact-name queries for `Fork Me Up`, `ForkMeUp`, and `Fork-Me-Up` in the [USPTO Trademark Search](https://tmsearch.uspto.gov/search/) and exact package-identifier requests to the [npm registry](https://registry.npmjs.org/) and [PyPI](https://pypi.org/). It reported no exact result at that time. The [INPI trademark search](https://busca.inpi.gov.br/pePI/) and [WIPO Global Brand Database](https://www.wipo.int/en/web/global-brand-database) were not verified. Search results can change, and this record is neither a legal clearance nor a guarantee of registration or availability.

## Validation

This decision is in effect when the unmodified Apache-2.0 text, `NOTICE`, and trademark policy are present; the product specification and README describe the same scope; ADR-0001 points to this decision; and the M0 queue advances to the toolchain/workspace slice. Publishing, changing repository visibility, releasing packages, or adding proprietary Cloud/Pro code remains separately gated.
