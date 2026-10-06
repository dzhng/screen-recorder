# Bounded speech evidence

The accepted recipe bounds primary windows while retaining independent context
observations and original source estimates. [The report](recipe-report.json) binds
raw artifact identities, resource measurements and observed lexical differences.
The [slice](../../slices/08-bounded-speech-preparation.md) owns the resulting contract.

## Reproduce the retained checks

Build core and composition first. The existing reference runner admits a selected
retained case and traverses every word through one-row source pagination:

```sh
node packages/test-harness/speech/timing-replay.mjs --inventory specs/video-editing-feedback/assets/08-bounded-speech/replay-cases.json --case long-repeated
node packages/test-harness/speech/timing-replay.mjs --inventory specs/video-editing-feedback/assets/08-bounded-speech/replay-cases.json --case bounded-outer-context
```

Its `--help` owns case discovery and limitations. The inventory supplies actual
readable support and execution explicitly. The long receipt predates separate
physical-support echo and null full-source range encoding; replay ports these
known inputs in the reference adapter, preserving original request/receipt/raw bytes.
Production receipts require execution, readable support and every window's ownership.
Every admitted raw line also requires ownership. Older observations use the
[reference-only port](../../../../packages/test-harness/speech/reference-raw.mjs),
which writes a modern derivative carrying the frozen source hash, adapter identity,
execution and readable support. It preserves word operands and never attributes
these added fields to the historical native worker; frozen original files stay intact.

The native speech test product replays independent real decodes with no model or
inference access. Paths in its case inventory resolve beside that inventory:

```sh
swift run --package-path helpers/mac -j 4 YapSpeechTests --boundary-cases specs/video-editing-feedback/assets/08-bounded-speech/boundary-cases.json --case long-shifted-boundary60
```

The native test product's `--help` owns selection. Cached candidate requests and
receipts retain their original recipe labels. Pure replay re-evaluates their raw
observations with the chosen matcher; it never relabels candidate published words
as current-recipe output. Focused core regressions exercise
retained reads, bounded generation pins, project dependency reads, phrase continuity,
execution refusal, cancellation/retry and portable ownership; the test files own
assertions. Red/green logs preserve the specific former failures.
Review regressions also preserve bounded source-generation pins in cursor-only
project continuations and refuse raw lines that omit receipt-declared ownership.

## Real work and limits

The paired 25-second source excerpts and prior whole-interval observations belong to
[slice07 evidence](../07-speech-timing/README.md). Original media stays in the
[fixture collection](../../../../fixtures/video-editing-feedback/README.md).
The100-second stress input repeats exactly the region excerpt's Float32 data four times;
its media digest/construction are retained in the report, not a second large fixture.
The worker used the pinned FluidAudio/Parakeet inputs named by the captured requests,
inside a network-denied sandbox, with this checkout's own compiled output.

Disjoint 20-second inference changed the seam word "submit". Internal context preserved
that occurrence in both excerpts. An overlap-only temporal matcher refused the
100-second trial when two "going" estimates touched after an 80ms shift. Unique mandatory
shared-context word correspondence passes that retained case without an epsilon or
estimate repair. Ambiguous repeats, absent peers and shifted exact points refuse
in the native controls. The full100-second run resolves all four seams and keeps each
selected raw observation exact; peak resident memory does not grow relative to the
25-second comparator, and the largest decoded window is 28 seconds at 16kHz.

This proves bounded work and correspondence ownership, not recognition accuracy or
isolated-transcript parity. The repeated stress input contains synthetic joins;
its recognition includes an extra "enough" at some joins, phrase substitutions and
omitted "AI" occurrences relative to four isolated25-second results. Those differences
are retained rather than calibrated away. Timing estimates remain conditional
engine evidence, never audible ground truth or cut permission.

`bounded-native-final-*` captures new native inference for 18–22s with 2s outer
context: decoded 16–24s, 10 primary words, 128000 samples, original physical support
0–25-second and exact execution echo. Context observations remain raw while unread primary
support is `not_observed`. A separate tiny full-admitted-support wire check verifies null
range echo and explicit `too_short`, without loading the engine. No source library,
installed app, original fixture or human editorial project was changed.

## Integrated caller cutover

[The controlled public report](caller-cutover-report.json) and
[scoped receipt](caller-cutover-receipt.json) exercise explicit source preparation,
readonly CLI/MCP queries, immutable edits, PCM delivery, restart and replacement
identity using frozen ASR responses. The modern reference derivative reports actual
historical decoded support rather than claiming the request's entire availability.
Every original lexical/token/source operand remains exact in short whole-support
comparisons after checking additive ownership/candidate metadata. Longer/context
inputs cannot inherit that topology comparison. Native wire checks use the integrated08
binary; picture13's earlier binary is not used to claim08 speech readiness.

The public CLI wait regression was red without a preparation observer and green
with job observation followed by generation-pinned `transcript.get`. Execution range
and context are preparation fields; they never become display filters or getter
arguments. Personal-release callers prepare once before readonly enumeration.
The package cancellation/retry fixture now composes the actual speaker evidence
and processing owners, matching production even when no speaker job is requested.

[Independent review](caller-cutover-review.md) covers the full caller pass and its
final focused changes; [the receipt](caller-cutover-review-receipt.json) pins both
completed review event streams.
