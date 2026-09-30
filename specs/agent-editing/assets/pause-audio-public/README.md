# Explicit pause ambience through public transports

Verified mechanically with the frozen worker whose digest is in [report.json](report.json).
The [journey](../../../../packages/test-harness/editing/pause-audio.mjs) uses the
existing CLI/MCP service harness and ordinary extraction, insertion, placement,
processing and history operations. No production API or default policy changed.

The synthetic source contains a known ambience-only prefix followed by noisy,
amplitude-modulated harmonics. This is a signal fixture, not intelligible speech.
The prefix has no voice component by construction; low energy or missing ASR words
are not used to infer that a real recording is speech-free.

A named audio track receives a half-second gap. Retained PCM remains byte-exact
before the insertion and after its explicit timeline shift. The gap is exactly
zero until the caller places the retained excerpt. Overlapping repetitions use
separate tracks because tracks prohibit overlapping clips. Gain and all fades are
explicit caller edits. The rendered PCM agrees with an independent sample-domain
mix calculation; the report records the error and authored transition windows.
The source and project both use 48 kHz Float32, so this run needs no protected
join exclusion and observes zero resampling influence. That result is not a bound
for converted-rate sources.

Undo separately restores the silent gap and the original source PCM. The video
export commits the selected revision and matches the preview bytes. The picture
is a plain canvas: independent audio/video edit scope was not exercised.

[evidence.zip](evidence.zip) retains the source, PCM comparisons, rendered preview,
export, receipts, service log, exact harness snapshot and per-member SHA-256 manifest.
A temporary mutation made public gap insertion add one extra millisecond; the
retained-length assertion rejected the additional 48 stereo frames. The generated
JavaScript was restored before the final passing run. No native build ran.

Real-voice listening, loop naturalness and a pause-specific selected RNNoise branch
remain unverified. These fixture gain/fade choices are neither recommendations nor
product defaults, and this evidence does not select between ambience fill, noise
reduction and deliberate silence.

Reproduce with a prebuilt compatible JavaScript checkout and explicit frozen worker:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/pause-audio.mjs --out /tmp/new-pause-evidence
```
