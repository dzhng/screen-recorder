# Complete sentence with known added noise

**Listening pending.** The sentence is “The sample offer says this is free.”
Its unchanged [clean baseline](../15a3-protected-sentence/original.wav) is the
existing public extraction from the user's recording. Wording and boundaries
remain inherited ASR proposals, not independent labels.

Compare the [noisy original](mixture-source.wav) with the
[RMS level-matched denoised copy](mixture-processed-matched.wav).
One listening question: **Does the level-matched version reduce the added noise
while keeping every word clear and natural?** The [raw denoised output](mixture-processed.wav)
is retained separately so its actual gain is visible.

The [assembler](assemble.mjs) adds declared deterministic 60 Hz hum, seeded hiss
and three modest 20 ms triangular noise bursts, using the existing
[matched-noise](../12c-matched-noise/run.py) aggregate 10 dB input policy. Two channel
seeds and hum phases produce authored stereo noise; this is not a real stereo
capture or spatial-quality pass. Original speech samples are duplicated unchanged
before noise addition. The resulting full sentence retains 129,600 frames at 48 kHz,
2.7 seconds, with no cut, fade, retiming or clipping. No clean source copy is stored
here; [source identity](manifest.json) points to the existing baseline.

Actual public import, source delivery, dry project delivery and one output RNNoise
stage run through the existing isolated CLI/MCP service and pinned native worker.
All six source/dry/processed deliveries have matching CLI/MCP bytes and exact
duration. Source and dry PCM equal the complete authored inputs. The selected
fixed RNNoise recipe remains unchanged. The companion noise-only public run measures
attenuation separately; it is not a listening surface or evidence of residual
noise inside speech.

The diagnostic copy applies only Float32 gain after the saved raw candidate,
offline. Its gain is 1.308406796 (+2.334856dB), targeting the unchanged clean
sentence's RMS rather than the noisy mixture's RMS. This is an explicit review
aid, with no public-delivery, perceived-loudness or product-normalization claim.
Raw candidate and authored noisy-input levels remain unchanged and unnormalized.
The diagnostic peak is 0.101753, with no clipping.

The [manifest](manifest.json) reports raw levels/component hashes and separates
noise-only attenuation (−34.866dB), clean-reference change and mixture error
against the baseline (+4.281dB relative to added noise). RNNoise changes the
clean-reference waveform as well; those values include original ambience and
level/speech changes and cannot establish retained phonemes, intelligibility,
naturalness or perceived noise improvement. No subjective pass threshold is fitted.

[Compressed public receipts](receipts.json.gz) retain full requests and MCP audio
payloads. Compressed Float32 noise input/output preserve the measured components.
[Independent reconstruction and review](review.json) checks complete source/dry
PCM, authored-noise recipe, gain-only diagnostic, hashes, finite samples and raw
metrics. The setup initially needed links to already installed workspace
dependencies; nothing was installed. Codex CLI review was unavailable because its
configured model was unsupported; no model override or retry occurred.

Reproduce into a fresh directory with existing built JavaScript and the frozen
worker:

```sh
SCREENREC_NATIVE=/tmp/screenrec-03d-native-build/debug/screenrec-native node specs/agent-editing/assets/15a3-noisy-sentence/assemble.mjs --out /tmp/noisy-sentence-fresh
```

This packet supplies a known-noise listening case. It does not close broader
12c/15a3 quality, independent word labels, other speakers/material, real spatial
acceptance or uninterrupted whole-take history. No model preparation, new engine,
capture, playback, generated voice or production change occurs.
