# Recorded narration with explicit accompaniment

A short synthetic musical fixture now overlaps real recorded narration through
public asset import, editing and audio delivery. The accompaniment is authored
into the fixture itself: a deterministic stereo triad with 100 ms source ramps,
placed only at project seconds 3–6, with an explicit clip gain of 0.25. It is not a
real music recording or evidence of musical/listening quality. No automatic fade,
ducking, normalization, model or production processing owner was added.

Every delivered mixed Float32 sample equals the original narration plus the known
fixture sample at its explicit gain, including exact Float32 rounding at gain
and sum. Samples outside the accompaniment are byte-identical to the original
narration. The starting project is the already verified visual-edit revision. Its existing
narration/video clips and tracks remain unchanged by accompaniment; a matched
frame also retains identical pixels. A public zero-gain revision mutes only the
bed and a public half-gain revision changes only its level: both match their own
known results and fail the intended quarter-gain mix. Undoing each negative
restores the intended mix; undoing accompaniment restores the pre-accompaniment
document and original narration PCM. Original source-file hashes remain unchanged.

The existing [narration preservation](../08-narration-preservation/README.md)
journey retains all nine original checks, including its visual edit, historical
revision/restart, undo, fractional PCM and encoded-clock/export gates. The new
helper reuses that same project and native/public delivery, adding no parallel
project setup. The accompaniment check concerns lossless public audio; the
baseline's encoded-clock results are not relabeled as encoded music validation.

[Verification](verification.md) records commands and the scoped independent review.
The archive retains both captures, complete WAVs/media, authored bed, exact request
and receipt identities, and the negative outputs. Full original/mixed WAVs form a
matched listening pair; `music-mixed-range.wav` is an optional four-second context
around both accompaniment boundaries. No playback or listening assessment was
performed. Natural joins, perceptual balance, real music quality, denoise/retiming
and whole-slice 08 acceptance remain separate requirements.
