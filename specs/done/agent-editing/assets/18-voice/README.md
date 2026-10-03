# Local reference speech reproduction

Historical reproduction checkpoint: the pinned candidate runs offline and meets
the observed warm speed and memory targets. The limitations below describe this
initial direct-concatenation probe. Current [slice18 acceptance](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/18-voice-reproduction.md)
combines later lexical/visual evidence and the user's exact contextual verdict;
[19f](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/19f-public-voice-jobs.md) owns public durable generation and
asset admission. The rejected source pause leaves19's ambience gate open. These
later results do not approve this initial probe's rejected raw joins.

The [manifest](manifest.json) owns the six measured runs, model file hashes,
dependencies, reference selection, desired texts and output hashes. The
[case definition](../../../../../packages/test-harness/editing/voice/cases.json)
fixes a short word and whole-phrase replacement before synthesis. Three copies of
the same actual five-second narrated fixture excerpt exercise reference paths.
This isolates path origin from voice/reference differences; it is **not** evidence
of three speakers, managed external-file admission or past-project retention.
Those ownership paths remain simulated until their production slices run.

The reference transcript is inherited ASR, not a new listening annotation. The
phrase replacement uses a historically auditioned removal range; that earlier
approval does not transfer to generated speech. The word replacement uses an
ASR-only range. Splicing directly concatenates untouched context and the complete
output, without trimming, stretching, normalization or crossfading. This exposes
actual duration mismatch and joins rather than hiding them with a fit policy.

## Observed performance

The first observed process loaded the model in 40.53 seconds and generated the
0.88-second word in 25.54 seconds: 66.08 seconds combined, excluding Python imports
and provenance hashing. The five subsequent requests in that process had RTF
1.258–1.926 (generation wall time divided by output duration). This is a small
single-host sample, not a percentile claim or a bound on future runs. System and
Metal caches were not purged; “cold” means this process's initial load/request.

Peak MLX allocation was 6,417,643,957 bytes (5.98 GiB). Process peak RSS was
2,353,397,760 bytes (2.19 GiB); these counters overlap and must not be summed or
presented as an independently sampled total GPU/process footprint. Both observed
counters are below 12 GiB. The 0.88-second word exceeds its slot by 0.48 seconds;
the 3.36-second phrase exceeds its slot by 2.40 seconds. No fit was applied.

All three origin paths produced identical bytes for each text at seed 18 in this
run. Frozen WAVs, rather than the seed, remain the replay authority. Numeric speed,
finite samples and repeatability say nothing about the listener's identity or
whether the desired words were pronounced correctly.

## Explicit preparation and offline reproduction

The primary implementation is [MLX Audio at the pinned commit](https://github.com/Blaizzy/mlx-audio/tree/4ab7e6f7dedd69a136cfaa318c5dc8aed5119446).
The [model revision](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16/tree/1eccf1cb2519b5a4e8a95b5f0544f3303568164f)
was verified before installation. The runtime's ICL path clamps the requested
repetition penalty to at least 1.5; the observed recipe preserves that behavior.
Its own RTF field is audio/wall, so the report computes the contract's wall/audio.

Prepare deliberately in isolated directories, from the repository root:

```sh
uv venv --python 3.12.14 /tmp/screenrec-voice-venv
uv pip install --python /tmp/screenrec-voice-venv/bin/python -r specs/agent-editing/assets/18-voice/requirements.txt
HF_HOME=/tmp/screenrec-voice-hf HF_HUB_DISABLE_IMPLICIT_TOKEN=1 hf download mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16 --revision 1eccf1cb2519b5a4e8a95b5f0544f3303568164f --local-dir /tmp/screenrec-voice-model
HF_HOME=/tmp/screenrec-voice-hf HF_HUB_DISABLE_IMPLICIT_TOKEN=1 hf cache verify mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16 --revision 1eccf1cb2519b5a4e8a95b5f0544f3303568164f --local-dir /tmp/screenrec-voice-model --fail-on-missing-files
node packages/test-harness/editing/voice-reproduction.mjs --case reference-origins --out /tmp/screenrec-voice-results
/tmp/screenrec-voice-venv/bin/python packages/test-harness/editing/voice/verify.py /tmp/screenrec-voice-results
```

Inference runs under an OS sandbox denying network, as well as offline library
flags. The [canary](network-canary.txt) failed with EPERM. Preparation downloaded
only public runtime/model files; fixture audio was never uploaded. The runner
accepts explicit alternate runtime/model paths for experiments, so compare its
recorded dependency and model hashes with this manifest before claiming a matched
reproduction. No automatic model download is performed by this runner.

The independent [verification](verification.json) checks output hashes, exact
retained context samples, inserted PCM and sample-count conservation. A byte
mutation makes it fail. These checks do not assert listening quality.

## Audition and visual evidence

Start with [reference](reference.wav), [original context](context.wav),
[word output](same-take-word.wav), [word in context](same-take-word-context.wav),
[phrase output](same-take-phrase.wav) and [phrase in context](same-take-phrase-context.wav).
The remaining origin outputs are retained independently despite matching hashes.

The join PNGs show 500 ms windows: entry or exit is the center vertical line,
with 250 ms on either side. Upper panels are waveforms; lower panels are spectra
with time left-to-right and frequency from 0 Hz at the bottom to 12 kHz at the top,
using logarithmic intensity. They have no calibrated amplitude axis and cannot
establish click audibility. [Plot commands](plot-commands.json) reproduce the
windows from frozen context WAVs. Independent visual review remains open; do not
infer a passing splice from these images or silence from the user.

Next acceptance work is independent audition of every distinct requested output
and both joins, reference-transcript checking, calibrated comparison with original
boundaries, and real asset-origin lifetime verification. This experiment remains
a research checkpoint while those gates are open.
