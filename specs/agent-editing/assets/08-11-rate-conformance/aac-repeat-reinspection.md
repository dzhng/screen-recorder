# Retained AAC source-repeat reinspection

Read-only reinspection of the unchanged archive corrects an inaccurate summary:
source repeat 5 differs from source 0; the other source repeats and all eight
isolated resampled repeats match their first member. The [receipt](aac-repeat-reinspection.json)
authenticates the archive and 21 selected members and recomputes every complete
PCM comparison. No native process, codec, tolerance or artifact was changed.
The [root verification](aac-repeat-root-verification.json) independently rehashed
the archive and recomputed the differing complete PCM pair after integration.

Both differing outputs contain 74,480 mono Float32 frames at 44.1 kHz. Their 1,486
changed samples lie at returned indices 72,399–74,479. Maximum error is
6.705522537231445e-8; RMS is 2.346948173843623e-9. The first sample matches; the last
sample does not. Small numerical error alone therefore cannot establish the
endpoint-exact part of an earlier AAC comparison contract. No new cross-invocation
or resampled-AAC allowance follows from this observation.

The retained script launches a new native process for each request, using the
historical worker identified by SHA256
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
It supplies the same encoded AAC bytes and `media.sourceAudio` selection each time:
track 1, zero source offset, support 0–2 seconds and range 123457–1812349µs.
Only request/output names vary. Every source receipt reports 81,920 decoded frames;
each call has a fresh native worker and application reader. No composition or
44.1-to-48kHz resampling is requested by this source-only comparison; platform
internal state was not inspected. Binary identity is historical provenance, not a claim that
the current worker was exercised.

This establishes variability in the retained native source-extraction outputs
before composition. It does not distinguish platform decoder behavior from the
surrounding source-reader/writer path. It also cannot explain the original
5.960464477539063e-8 mixed-range discrepancy: that failing ranged WAV was not
retained, and separate source variability is not causal proof for missing PCM.

The immediate action is this evidence correction, not a decoder patch or another
parameter sweep. The exact frozen-decoder arithmetic controls remain valid. Any
future claim about current-runtime source reproducibility needs a separately
scoped test of these retained bytes and requests; no such run is inferred here.

A separately scoped [current-worker cohort](current-source-cohort/README.md) now
records eight exact repeats for the same retained source/request. It does not
change the historical findings or establish universal reproducibility.
