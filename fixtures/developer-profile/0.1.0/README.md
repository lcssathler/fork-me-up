# Synthetic Developer Profile fixtures 0.1.0

These fixtures support the M1 technical MVP without introducing a second profile interchange contract. Each file is a valid unreleased Portable Profile Export `0.1.0` used only as a versioned, synthetic input carrier. The Core loader validates the carrier through Protocol, extracts the profile payload and profile revision, copies them into an immutable private runtime value, and discards export, subject, generation, and exclusion metadata.

The three fixtures establish only the inputs needed by later M1 behavior slices:

- `demonstrated.json` contains attributable synthetic evidence and one demonstrated claim;
- `adjacent.json` contains demonstrated Angular evidence plus a separate explicit, limited React-adjacency claim;
- `insufficient-evidence.json` contains no evidence and one explicit uncertainty claim.

They contain no real developer, repository, path, credential, conversation, or private-source data. Fixture validation alone does not apply claim precedence, select a response policy, derive demand, compile a DCP, persist a profile, authorize disclosure, or prove client behavior. M1-S02 consumes the validated Claims in pure Core policy evaluations without changing those remaining boundaries.
