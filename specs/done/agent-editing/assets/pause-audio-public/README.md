# Explicit pause ambience through public transports

Verified mechanically with the frozen worker whose digest is in [report.json](report.json).
The [journey](../../../../../packages/test-harness/editing/pause-audio.mjs) uses the
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
export, receipts, service log, exact harness snapshots and per-member SHA-256 manifest.
`exchanges.json` keeps the actual request/options and complete CLI JSON envelope or
MCP tool reply for every public call, captured before assertion/caller mutation.
The shared harness captures these only when a journey opts in, so ordinary and
scale journeys retain their existing compact reporting.
A temporary mutation made public gap insertion add one extra millisecond; the
retained-length assertion rejected the additional 48 stereo frames. The generated
JavaScript was restored before the final passing run. No native build ran.

The independent RNNoise branch begins again at the silent-gap revision. Public
capabilities advertise the already-linked fixed recipe; no model preparation or
native build is required. The caller selects a narration-track window across the
pause. Prepared and ordinary PCM match, dry inspection preserves the silent-gap
baseline, an explicit half-wet mix matches the independently calculated Float32
blend, and samples outside the selected window remain exact. Bypass and undo
return the exact silent gap, the source stays immutable, and no room-tone tracks
or clips are added. The processed movie retains the project duration.

This checks the advertised adapter identity and public mix/scope contract, not
independent RNNoise inference parity: the historical standalone C oracle was not
available and was not rebuilt. Real-voice listening and loop naturalness remain
unverified. These fixture gain/fade/mix choices are neither recommendations nor
product defaults, and this evidence does not select between ambience fill, noise
reduction and deliberate silence.

Reproduce with a prebuilt compatible JavaScript checkout and explicit frozen worker:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/pause-audio.mjs --out /tmp/new-pause-evidence
```

[Root integration](root-verification.json) verifies all archived members and both
merged harness snapshots, then reruns the public workflow successfully using the
unchanged frozen worker. Its recorded limitations remain binding.
