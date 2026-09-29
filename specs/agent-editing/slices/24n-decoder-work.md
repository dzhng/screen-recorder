# 24n — Measure actual decoder and descriptor work

Status: scoped telemetry/accounting verified; descriptor byte-work red retained
in [evidence](../assets/24n-decoder-work/README.md). This does not close parent 24 or
change audio sampling, codec tolerance, cache identity, or inspection budgets.

## Contract

Completed composition reports measure native decoded frames grouped by native
sample rate and decoded Float32 sample payload bytes. Counts include discarded
codec/converter context, fragmented readers and state preparation exactly once.
The existing request source owner accumulates released readers without retaining
them. Rendered frames and output bytes are separate measurements.

The existing descriptor loader snapshots successful `pread` bytes (including its
12-byte header) and bytes delivered to AVFoundation on its serial queue. Counts
include repeated reads and partial reads; they do not measure physical disk I/O.
URL-backed AVFoundation reads remain explicitly unknown. The 64 MiB delivered-byte
inspection budget and all cancellation/read semantics remain unchanged.

## Verification

Drive actual native composition with fixed source contexts and short late windows
of retained long lossless/compressed sources (or bounded 60s fixtures if absent).
Compare complete output PCM: lossless exact; AAC uses the existing codec-specific
numerical conformance threshold. Cover omitted inputs, fragments, resampling
context and short state preparation. Demonstrate actual decoded work excludes a
full source prefix; record descriptor bytes and worker RSS independently. Bank
any byte-work failure instead of claiming decoded-frame bounds also prove I/O
bounds. No full two-hour DSP rerun, source restore, or audio quality judgment.

Root owns parent 24 status, hub and choices integration. Evidence and measured
limitations belong in `assets/24n-decoder-work` after focused review.
