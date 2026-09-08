# Generic conformance consumer

This private, unreleased reference harness is the second Fork Me Up consumer. Unlike the Codex lifecycle adapter, it is a stateless command-line process: it reads one DCP JSON value from standard input and emits one structured result. It has no Provider, Core, source, profile, lifecycle, cache, network, or write capability.

The consumer depends only on the public `@fork-me-up/protocol` artifact. It validates the exact DCP `0.1.0` draft, expiry and audience binding, then retains only Claim capability/state/observed-depth and the six structured Response Policy fields. Task summaries, limitations, rationales, corrections, provenance and other free text remain inert and are not emitted. The result explicitly records `authority: "none"`.

Local-assistant packets require no argument. An external-consumer packet requires its exact opaque audience identifier:

```text
node consumers/generic/src/main.mjs [--consumer-id <opaque-id>] < packet.json
```

Invalid, incompatible, expired, oversized or audience-mismatched input produces the same fixed `no-context` result without input content or native diagnostics. This harness demonstrates the bounded draft behavior only; it is not a published package, general client integration, authorization mechanism or compatibility claim.
