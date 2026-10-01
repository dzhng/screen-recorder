# 24z6 — Composition append runs

Status: integrated source correction, complete scalar parity and bounded append
work pass. The full composition and durable project consumers pass; the three
previous project-evidence deadline failures now pass unchanged. The
[evidence packet](../assets/24z6-composition-appends/README.md) preserves the
original source and red/green observations. This does not establish timeout causality.

## Supported amplification

The production `applyBatch` entry point validates each alternating operation;
the existing placement run ends at `track.add`. A scratch observer of composition
validation measured three track/clip pairs as seven validations visiting twelve
track and nine clip entries. Seventy pairs visited 4,970 track and 4,900 clip
entries; 140 pairs visited 19,740 and 19,600. All complete receipt digests are
retained for comparison. This is quadratic prefix work, even though a batch has
an existing operation ceiling. The observer is diagnostic instrumentation, not a
new production hook or a permanent internal-call test.

## Correction contract

Extend the existing stateless append owner, preserving every created identity,
label, operation receipt, dependent operation and first invalid prefix. A place
that names a not-yet-created track by literal ID must remain scalar: a later track
could otherwise make an invalid prefix valid. Stateful processing remains scalar.
No new public API, cache, deadline or limit is warranted.

The full composition, project-store and unchanged project-evidence suites pass.
Scalar comparisons preserve complete receipt/error parity. A smaller validation count proves bounded append work;
it does not establish a general latency or physical/media quality pass.
