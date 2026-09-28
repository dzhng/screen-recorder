# Matched stationary-noise comparison

The frozen learned and conventional processors make different tradeoffs on the
same inputs. RNNoise suppresses the noise-only control strongly, but its output
also differs much more from the original reference. The fixed conventional recipe
changes the reference less and barely attenuates this added noise. The user prefers the learned result in the [listening comparison](audition/README.md),
so RNNoise leads the next experiments. Neither is yet accepted as a production
default or a protected-speech solution.

The [plan](plan.json) fixes a five-second retained real narration extract, decoded
once to mono 48 kHz float PCM. This reference includes its original ambience; it
is **not** a studio-clean speech ground truth. A deterministic 60 Hz hum plus
seeded hiss is scaled to an aggregate 10 dB reference/noise ratio. Both processors
receive identical reference-only, noise-only and mixed samples, with unchanged
raw gain. Their previously measured delay/tail recipes remain fixed.

| Measurement | Conventional afftdn | RNNoise |
| --- | ---: | ---: |
| Noise-only output/input RMS change | −0.48 dB | −48.32 dB |
| Mixture error versus reference, relative to input noise | −0.19 dB | +5.87 dB |
| Reference-only output correlation with reference | 0.9973 | 0.8062 |
| Reference-only RMS error | 0.000763 | 0.006214 |

All six processed selections contain exactly 240,000 finite samples and no clipped
samples. The large noise-only attenuation cannot establish speech quality: a
processor that silenced everything would also score well on that measurement.
The mixture error includes both changes to the reference and remaining noise;
it is not a separately recovered noise track. Likewise, subtracting processed
reference from processed mixture measures sensitivity to added noise, not a
linear decomposition of either nonlinear processor.

An analytical best-fit output gain barely improves the reference error for either
candidate. It is a diagnostic only, never applied to retained audio. This rules
out a simple constant volume mismatch as the sole explanation for this cohort's
reference difference; it does not prove lost words or audible damage. The original
recording's ambience and each processor's phase/tonal changes are included.

## Reproducibility and evidence boundary

The [runner](run.py) verifies the existing pinned executable and input hashes,
uses the same compensation as the prior timing studies, and denies network access
for learned inference. No model or dependency was downloaded. The [compressed
report](report.json.gz) retains exact commands, hashes, levels and 10 ms energy
windows. `gzip -dc` reads it. [Raw audio](audio/) is gzip-compressed little-endian
float32 mono at 48 kHz; RNNoise's untrimmed outputs are also preserved so its
declared 960-sample compensation remains auditable. No loudness matching, playback
or installed-app change occurred.

[Independent review](review.md) recomputes the measurements without changing the
quality boundary. A fresh [confirmation](confirmation.json) reproduces all twelve raw audio hashes
and every energy window. No parameter was retuned between trials. Run:

```sh
python3 specs/agent-editing/assets/12c-matched-noise/run.py --repo <checkout> --out <fresh-output> --ffmpeg <pinned-ffmpeg> --processor <pinned-rnnoise-api>
```

This is a mechanism comparison, not a new quality threshold. [Independent clean speech and a level control](../12c-clean-reference/README.md)
now extend the comparison. Next verify protected consonants/onsets/ends and
[optional listening](audition/README.md) before selecting a backend. Transient noise, retimed/overlapping speech,
channel policy and production state/stack integration remain open. The established
pure-split and excluded-input requirements are unchanged.
