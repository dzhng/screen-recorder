# Full-support measurement correction

This follow-up corrects research measurements, not the stretch algorithm. The
[original frozen experiment](../13a-signalsmith/README.md), its artifact manifest and
all original media remain unchanged. Its phrase “full support windows” is
superseded by this report: the old measurement inspected only a latency-sized
neighborhood and omitted admitted samples above its own threshold.

The [shared measurement owner](../../../../../packages/test-harness/editing/stretch-measurements.mjs)
now scans the entire admitted output. Combined signals get one full-output support
report; separate leading/trailing impulse runs measure each endpoint independently,
so another impulse cannot be mistaken for its support. Raw diagnostic pre-roll and
tail are also scanned completely, with their offset explicitly reported. Support
uses the unchanged amplitude threshold of `1e-7`. The scanned interval is half-open;
the first/last threshold crossings are inclusive sample indices and do not imply
every sample between them exceeds the threshold.

At 0.8× and endpoint phase zero, the isolated leading impulse has above-threshold
output through sample 5,595, while the old window stopped at 2,879. The trailing
impulse begins at 83,520, earlier than the old report's 87,118. These are low-level
signal-support observations, not proof of missing or intelligible speech. Peak
displacement and full support answer different questions.

## Numerical gate and reproduction

Both runners use the same pitch estimator. A result explicitly says `measured`,
`unavailable`, or (when processing refuses the input) `not-rendered`. Every
successfully rendered tone claiming pitch acceptance requires an available
estimate and less than 1% error. Insufficient crossings can no longer silently
skip that gate. Long-tone acceptance retains its previous minimum crossing count;
the short-window experiment requires enough crossings for its shorter observation.

Use a fresh reference directory from the original reproduction, then run:

```sh
node packages/test-harness/editing/stretch-signalsmith.mjs /tmp/stretch-reference /tmp/stretch-support-candidate
node packages/test-harness/editing/stretch-short.mjs /tmp/stretch-reference /tmp/stretch-support-short
node --test packages/test-harness/editing/stretch-measurements.test.mjs
```

[report.json](report.json) and [short.json](short.json) contain the regenerated
observations and measurement-code hashes. This pass reconstructed the original
PCM inputs from their existing recipes and frozen real narration, verified every
input hash against the frozen reference, and reran Signalsmith. It did not rerun
the older native stretch algorithm. [verification.json](verification.json) records
the matched output identities and unchanged original artifact hashes. The
processing implementation and settings did not change: every previously frozen
exact output and every successful short output reproduced byte-for-byte.

The [support-window mutation](support-window-red.txt) reinstated a latency-sized
scan and failed the support tests. The [octave mutation](octave-red.txt) changed
the temporary processor's transpose factor and failed the actual short runner's
pitch gate. The [silent-output mutation](unavailable-red.txt) zeroed the temporary
processor's output and failed with an explicit unavailable estimate. Sources were
restored before the [green tests](measurements-green.txt); no mutation is in the
processing implementation.

## What remains open

Numerical reproduction still does not prove protected words survive either join,
intelligibility, naturalness or perceived voice quality. No listening took place.
The short-window report still includes unsupported inputs; no automatic preset
switch, minimum editable duration or general short-speech policy is selected.
Candidate waveform panels and independent visual acceptance remain pending.
The frozen original audition WAVs remain the same candidate media. Slice 14 must
not adopt this as an accepted speech endpoint recipe until those gates close.
