# Independent clean-speech control

The frozen RNNoise recipe behaves differently on an independent clean-speech
reference: mixture error is lower than the added-noise baseline, and reference
correlation is much higher than on the original recording. Matching this utterance
to the original recording's quieter level barely changes the learned result.
Absolute volume alone therefore does not explain the earlier difference. This
still does not establish protected phonemes or audible quality.

## Fixed cohort and measurements

[Selection/provenance](selection.json) pins the lexicographically first clip in
Hugging Face's clean LibriSpeech validation subset, chosen before processing.
The original FLAC is unmodified. Its 16 kHz samples are decoded to the same 48 kHz
mono float convention used by the [matched-noise runner](../12c-matched-noise/run.py).
Both frozen processors, delay compensation, seeded hum/hiss and 10 dB added-noise
ratio remain unchanged. The second control changes only input gain so this same
utterance matches the original recording's RMS; no output normalization is applied.

| Measurement | Conventional, native / quiet | RNNoise, native / quiet |
| --- | ---: | ---: |
| Mixture error relative to input noise | −0.22 / −0.25 dB | −3.06 / −3.10 dB |
| Reference-only correlation | 0.99994 / 0.99781 | 0.98388 / 0.98378 |
| Reference-only error relative to reference | −39.17 / −23.52 dB | −14.95 / −14.92 dB |
| Noise-only attenuation | −0.28 / −0.48 dB | −45.85 / −48.56 dB |

Both levels preserve all 281,040 samples in each processed selection, with finite
values and no clipping. Native input RMS is 0.061801; the matched level is 0.010274.
The conventional fixed noise floor is more intrusive relative to quiet speech,
while it still barely attenuates this noise. The learned candidate retains more
reference change than the conventional one at either level. These are observations
on one utterance, not intelligibility scores or proof of lost speech.

Reports and raw audio are retained under [native-level](native-level/) and
[matched-level](matched-level/), with gzip preserving exact float samples and
commands. The original recording remains a separate cohort: its different noise,
speaker, bandwidth and speech content prevent attributing all differences solely
to cleanliness. The scalar error includes removed original ambience as well as any
speech/phase/tonal changes. Noise-only attenuation is never treated as separated
residual noise in speech.

[Independent review](review.md) verifies provenance, numerical evidence and the
limits above. The existing harness now accepts an explicitly hash-pinned alternate reference and
optional input-RMS control. The [default preservation check](preservation.json)
reproduces every prior input/output hash, metric and energy window exactly. No
production processor, profile, default level or model changes.

## Provenance and reproduction

The source is [hf-internal-testing/librispeech_asr_dummy at the pinned revision](https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy/tree/5be91486e11a2d616f4ec5db8d3fd248585ac07a).
The [dataset card](dataset-card.md) declares its clean validation configuration.
[OpenSLR's LibriSpeech source](https://www.openslr.org/12) credits Vassil Panayotov,
Guoguo Chen, Daniel Povey and Sanjeev Khudanpur and declares [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
LibriSpeech derives from LibriVox read audiobooks. The retained source clip is
unchanged; resampling, known-noise mixing and the quiet analysis copy are the
modifications made for this study. No voice cloning is performed.

Preparation used `hf download` with revision and exact filename pinned, downloading
the 9,192,059-byte Parquet file and retaining just the selected 120,041-byte FLAC
plus provenance. The public dataset is ungated. The HF SQL command initially
reported a missing DuckDB dependency; a scratch-only Python environment installed
DuckDB 1.5.6 to extract the first row. [Preparation logs](reader-install.log) record
that research dependency; project dependencies and the installed HF CLI were not
changed. No speech model was downloaded, and no audio was played.

Run the existing matched-noise command with `--speech <retained-flac>` and
`--speech-sha256 4e25e22555cd16e90edb0a3b49fdcf1fe652b2a1250ab643634db33895c75b41`.
Add `--reference-rms 0.010273766392624829` only for the quiet control. All other
arguments and pinned executables are the prior recipe. The study's
[predeclared experiment](experiment-plan.json) records the sequential level control.

Next verify localized consonants/onsets/ends and obtain independent listening on
both real-recording and clean-reference controls. A repeatable global error
improvement cannot select the state policy, guarantee sentence edits, or close
retimed/combined-input, transient-noise and stack acceptance.
