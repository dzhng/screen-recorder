# Retimed acoustic evidence

Waveform and spectral evidence must describe the samples actually delivered at the
requested project clock. This public CLI/MCP fixture uses two repeated stereo
occurrences under preserve-pitch and follow-pitch retiming. Its independent bucket
oracle reads the complete delivered PCM, while independent Hann-window DFT values
check sustained spectral bands. Earlier retiming evidence owns DSP correctness;
this gate tests the downstream acoustic interpretation of that output.

Full and fractional-range PCM agree at absolute sample bounds, repeated occurrences
agree exactly, and a pure split preserves PCM and every waveform bucket. Each
bucket's support, partial flag, minimum, maximum and RMS are checked independently.
Images retain the requested revision, sample range and channel clock. Waveform
peaks and time-localized spectral columns match actual PCM transients; deliberately
shifted positions fail. Independent tone power agrees with rendered intensity,
and the wrong pitch policy's frequency positions fail.

[Preserve-pitch charts](full-set-1.png) and [follow-pitch charts](full-set-2.png) show
full and ranged views. They intentionally differ in spectral pitch and transient
shape. The comparison metrics locate those differences; neither image is a visual
baseline that the other should reproduce. Low-level waveforms remain small on the
shared amplitude scale. This is no new claim about speech, listening, low-amplitude
waveform readability or perceptual stretch quality.

[Verification](verification.json), the [final report](report.json.gz), and the
[authenticated archive](evidence.tar.xz) retain complete media, eight reviewed
images and enlarged crops, comparison artifacts, both runs and source identities.
The final run has fresh project/revision/job identifiers in its header. Its entire
axes, signal panels, channel labels and footers are pixel-identical to the reviewed
set. Both original headers remain available, rather than being edited or hidden.

Run the focused case through the existing acoustic entry point:

```sh
SCREENREC_NATIVE=/absolute/path/to/frozen/screenrec-native node packages/test-harness/editing/audio-evidence.mjs --fixture retimed-tones --out /tmp/acoustic-retiming-fresh
```

The default tones-and-clicks journey is unchanged. No production code, dependency,
processing policy or installed worker changed. The [review](review.md) records
independent findings, fixes and the qualified visual verdict.
