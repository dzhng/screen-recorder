# Mixed source rates and acoustic axes

This checkpoint separates sample-clock correctness, arithmetic, codec reproducibility,
and visual readability. They are different claims: a small floating-point delta from
independent decoder invocations does not establish a clock error or mixer defect.
No production behavior or tolerance changed here.

The retained reports establish the tested 44.1 kHz AAC mono and MP3 stereo inputs
can overlap an independent 48 kHz stereo source, with exact sample counts,
fractional ranges, endpoints and split placement. Mixing a single frozen decoder
result is an exact float sum in both full and ranged requests. MP3 fresh-invocation
comparisons remain exact gates. Native AAC source seeking retains its previously
accepted maximum **and** RMS bound below one PCM16 step; no substitute bound was
selected for resampled AAC composition.

**An AAC reproducibility gap remains open.** One run failed an agent-created
zero-delta comparison between a ranged mix and a separately decoded/resampled
component: maximum difference `5.960464477539063e-8`. The initial and two subsequent
runs measured zero. Eight additional source and eight isolated resampled repeats
also measured zero. Frozen-decoder controls isolate exact arithmetic for those
inputs; they do not establish the cause of the earlier mismatch. The original red
report and log remain, and independent AAC comparison values remain visible
measurements. This is not whole compressed-composition exactness acceptance.
The early failing run discarded its ranged scratch WAV before retention; its
reported maximum survives, but that specific delta cannot now be localized from
PCM. The harness subsequently retains all windows before evaluating comparisons.

The public acoustic journey compares one authored 44.1 kHz stereo source with its
48 kHz project output. Delivered PCM, bucket min/max/RMS and sample clocks agree
exactly; the authored right-channel impulse remains at 0.64 seconds. Image checks
reject a shifted impulse interpretation and an incorrect Nyquist axis. CLI and MCP
return identical acoustic artifacts. The fresh visual review covered all eight
new full images and eight enlarged details from both captures: no confirmed axis
contradiction or label clipping, but the quiet tones have weak spectral contrast
and appear flat in the shared full-scale waveform. Crops require their full-image
context; printed time precision is not visually resolved timing precision.

The [execution record](verification.md) identifies the frozen worker, reproducible
commands and retained run boundaries. [Choices](choices.md) records why the AAC
comparison is a diagnostic rather than a newly relaxed gate. The complete capture
manifest and archive retain authored/encoded inputs, delivered WAVs and PNGs,
requests, receipts, hashes, failed diagnostics and both review logs.

## Boundary and next work

No listening, speech preservation, arbitrary admitted-format matrix, negative-PTS
media, retiming, general scale or whole-slice 08/11 acceptance follows from this
checkpoint. [Real narration preservation](../08-narration-preservation/README.md) now verifies
video-only edits and complete retained PCM separately. Explicit music overlap,
protected real-speech joins and listening remain separate acceptance work;
synthetic tones cannot satisfy them. Low/high rates and genuinely negative
occupied origins follow the [finite domain audit](../acceptance-maintenance/audio-domain.md).
Retiming remains a separate dependency.
