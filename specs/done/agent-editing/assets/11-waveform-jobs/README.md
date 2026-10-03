# Cached waveform lifecycle evidence

The [waveform owner](../../../../../packages/core/src/acoustic-inspection.ts) delegates immutable
selection and PCM preparation to the audio owner. An ordinary read can serve a
surviving waveform after PCM eviction; the waveform retains the exact audio job
and generation, source/project clock, selected range, processing tap and missing
support. Rebuilding needs a retained PCM lease. Releasing that lease before
publishing completed JSON lets the existing cache evict disposable PCM under
capacity pressure.

Default resolution is an overview, so a long selection does not fail merely
because the caller omitted a detail parameter. Explicit resolution remains exact;
the shared layout preflight refuses oversized requests before preparing PCM when
its sample clock is known. Source clocks without admitted sample-rate metadata
are checked once actual PCM is available. The JSON byte limit is independent of
bucket count and never drops unavailable support to fit.

[Tests](tests.txt) cover preserved audio behavior, actual native project taps,
cache/job behavior, persisted waveform state across owner restart, failed and
canceled prerequisites, and generation changes after the reader has acquired
actual PCM. The native worker is the same frozen worker recorded in the preceding
waveform-core evidence. Restart here reconstructs core owners over the persisted
catalog; actual service-process restart belongs to the public journey.

The [generation-fence mutation](generation-mutation.txt) publishes stale waveform
work and fails the regression. The [retry mutation](retry-mutation.txt) strands
failed/canceled PCM and fails both recovery cases. Restored code passes. Explicit
retry uses the existing audio retry owner once; ordinary reads never loop over
terminal failures. No separate dependency scheduler or polling loop was added.

Recipe planning preserves unsupported-format admission: [fractional sample-rate metadata](fractional-rate-red.txt) must reach the audio renderer, not fail in sample-clock arithmetic. The optional preflight clock exists only for safe positive integer rates.

Public waveform JSON delivery, waveform images, spectral evidence and agent/visual
acceptance remain unverified by this core pass. No listening claim is made.
