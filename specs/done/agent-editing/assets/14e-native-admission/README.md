# Native admission before retiming work

Native admission resolves real stream formats and physical retained support before
checking complete-run counts. It shares source/context resolution, the exact
stretch admission owner and the converter's exact demand/format checks with
execution. The state forest and ordinary graph both resolve before decoding,
processing scratch or output creation. Retimed sources must have stable,
conventional mono/stereo descriptions, including sources first opened by a
unit-rate clip.

[The wire report](wire.json) drives the actual worker with direct and `planFile`
requests. It verifies both pitch policies and channel counts, bound recipe
identity, short retained pieces, short physical support, hidden RNNoise
prerequisites and tiny equal-count identity. An actual two-lane discrete CAF is
refused for both policies and after a unit-rate clip has cached the source.
Selected NaN samples pass metadata admission but fail rendering without output;
a nonexistent destination parent remains untouched during admission.

Twelve native stereo-preserve outputs match the frozen linked-channel reference
completely after the existing graph's negative-zero addition normalization.
[The comparison record](linked-reference-parity.json) preserves each delivered PCM
hash and both raw and normalized reference hashes. No independent-channel
substitution or new DSP recipe is used. The [mono preserve](preserve-regression.json)
and [follow](follow-regression.json) suites pass after admission was integrated,
including the 300-run/256-descriptor case, cancellation and state preparation.

All fourteen preserve hashes match the earlier native run. Forty-three of the
forty-five follow hashes match. The other two retain exact counts but differ by
at most 2.98e-8 and 5.96e-8 in Float32 sample value. [Measured differences](follow-variation.json)
include affected frame counts and matching selected source WAV payload hashes;
separate native decoder output was not captured. A [bounded repeat probe](follow-repeat.json)
ran the same plan twice on each retained worker and obtained identical PCM across
all four. The cause of the earlier variation remains unproven and is not
consistently version-dependent. These results do not establish universally
bit-identical regeneration across worker processes or platform versions. Exact
reads from a prepared artifact and the named full/split/subrange comparisons are
separate, retained-byte guarantees.

[Attempts and review](attempts.json) distinguish old-worker refusal, a corrected
noncanonical test fixture and the strict-format review finding. The actual short
input predicate's deliberate mutation proof belongs to the
[shared exact-admission owner](../14e-exact-admission/README.md). Independent review
found no remaining native blocker after the format fix; it inspected code and
results without another build. [The manifest](manifest.json) binds sources,
evaluators, worker binaries, reports and the bounded plans/logs archive. PCM and
binaries are not copied into this folder. Historical `/tmp` paths in receipts are
provenance, not dependencies for reproducing the checks.

This evidence covers the private native consumer and wire boundary. It does not
by itself close public job/cache/package lifecycle, linked video timing or
listening acceptance. Retained playback intentionally needs no current retiming
binding, while explicitly supplied mismatches are rejected. No new audition is
claimed, and the accepted mono listening verdict is unchanged.

To reproduce, generate the frozen-reference fixture outputs with the existing
[stereo evaluator](../../../../../packages/test-harness/editing/stretch-stereo-parity.py),
then run [native admission](../../../../../packages/test-harness/editing/composition-admission.py)
with the `screenrec-native` path, that fixture-output directory and a fresh output
directory. Follow/preserve reproduction uses the native test worker and evaluators
linked from the [retained follow evidence](../14d-pitch-follow/README.md). Build only
into a new scratch directory and preserve previously retained workers.
