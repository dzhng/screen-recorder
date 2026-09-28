# Ordered gain evidence

Gain is applied at the existing processing position. The shared temporal compiler
retains authored settings for inspection and emits a compact numerical program for
execution. The PCM sample decides its value once for both channels. A fractional
cut selects active samples by floor without resetting the original envelope;
curve keys select their outgoing interval by ceil.

The [live journey](../../../../packages/test-harness/editing/gain-curves.mjs)
compares delivered CLI/MCP WAVs against independent source samples and analytic
curves, then checks taps, target scopes, bypass, windows and structural edits.
The old worker refuses the numerical gain request. A worker deliberately advanced
by one sample produces the wrong first PCM value and fails the same journey.
The constant baseline is checked separately against the older worker.

Movie preview/export wiring is exercised, including a stereo soundtrack and
identical preview/export bytes. Its synthetic waveform does not establish AAC
listening quality. No encoder policy or audio normalization is changed here.

The [native cost probe](../../../../packages/test-harness/editing/gain-cost.mjs)
compares constant and cubic gain on the same worker. Process startup and file IO
are included. Block size and peak resident memory accompany timing so a fast
result cannot hide a duration-sized allocation.

Retimed curve phase has pure compiler/edit controls. Delivered retime+gain PCM is
still unavailable because the stretch executor is not bound; both pitch modes
retain that existing refusal. This vertical cannot close slice14 or the remaining
transitions and convenience-command scope in slice16.

The [verification receipt](verification.json) records the delivered checks and
preserved artifacts. The waveform fixtures are deterministic stereo level markers,
not speech-quality auditions. Broader core runs encountered wall-clock timeouts;
all remaining affected cases passed unchanged when isolated. Their separate logs
are retained rather than presenting the broad suite as clean.
