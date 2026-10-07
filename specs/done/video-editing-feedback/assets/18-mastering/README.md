# Bounded dynamic mastering

The unchanged −14.5 LUFS/0 dBTP/7 LU request initially misses on an authored
12-second dialogue/percussion fixture. Frozen first-pass statistics and at most
three original-input offset candidates correct that fixture. An admitted candidate
stays held while correction proceeds; the smallest integrated-error admitted
attempt is delivered and identified by `selectedAttempt`. Strict
publication continues to refuse infeasible or stalled work. No gain-only fallback
or widened gate was adopted. Sources remain byte-identical.

[Protocol](protocol.json) records the policy accepted before implementation.
Historical baseline/confirmation JSON records independent research, including
reconstructed placeholder music, not the removed original trailer project mix.
The runnable independent reference is
[`mastering.py`](../../../../../packages/test-harness/editing/audio-recipes/mastering.py);
its owner README describes invocation. [Balanced reference](reference-balanced.json)
and [peak-limited reference](reference-peak-limited.json) retain exact operands and
hashes. Independent and production meters intentionally differ: the reference
uses full precision; production uses its existing one-decimal FFmpeg summary.

[Production evidence](production.json) contains all three actual native candidates:
−14.9, −14.7 and −14.6 LUFS, with fixed targets. The
[independent final-output oracle](production-oracle.json) observes −14.6256696 LUFS,
0.0208845221 dBTP and 0.255448784 LU LRA across exactly576000 frames. These pass
the existing0.2 LU,0.15 dB meter-specific peak excess and0.2 LU LRA excess gates.
[Peak-limited refusal](production-refusal.json) retains three measured attempts
and reports `NORMALIZATION_TARGETS_UNMET` without an output WAV.

The controlled stalled-meter test proves retirement after two identical results;
it does not measure accuracy. Disabling the progress guard produces a third
candidate and `budget-exhausted`, falsifying that test, then restoring it passes.
The deadline test first failed at230200ms instead of830200ms; budgeting all eight
bounded traversals passes, while retained audio keeps its short query budget.

[Decoded dynamic AAC](encoded-dynamic.json) records the actual encoded-delivery
measurements separately from the PCM master. It is evidence for this output,
not a universal encoded true-peak guarantee. `audio-processing.test.ts` owns the
production native cases and optional `YAP_AUDIO_ACCEPTANCE_EVIDENCE` retention;
`compiled-render.test.ts` owns scheduling proof; Core publication tests own
canonical candidate admission. Large generated audio remains scratch; this
record retains hashes, operands, numerical output and the reproduction owner.

The completed independent review found one P2: an interior-aim correction could
discard an already admitted candidate and then fail. A controlled native scanner
sequence −14.65→−15 LUFS falsified that path; nested existing artifact lifetimes
now deliver attempt0 and retain both observations. This is selection/lifetime
proof, not acoustic accuracy. A transient missing-await failure closed the
original prefix early and was corrected; five affected native cases now pass.
Core publication also refuses a selected index outside its recorded attempts.

The [independent decoded AAC oracle](encoded-dynamic-oracle.json) observes
−14.6261433 LUFS and0.151025553 dBTP, versus the production scanner's−14.6/0.1
summary. This is slightly above0.15 dB on that separate meter. PCM admission
passes; no strict encoded-peak claim is made and no tolerance was changed.

[Review receipts](review-receipts.json) bind both completed independent reviews.
The [initial finding](review-initial.md) was fixed test-first; the
[selection review](review-selection.md) has no findings. The public prepared-output
case passed after the evidence cutover, including excerpt and portable adoption.
The latest AAC container hash is associated with unchanged decoded-WAV bytes;
that byte equality permits reuse of the independent decoded-PCM measurement.
