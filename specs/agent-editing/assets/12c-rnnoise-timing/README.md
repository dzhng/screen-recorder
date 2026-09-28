# RNNoise frame timing and flushing

This follows the [unchanged example baseline](../12c-rnnoise/README.md) with the
same pinned library/model and build flags. The [public API probe](../../../../packages/test-harness/editing/rnnoise-frame-probe.c)
uses normalized float input converted to RNNoise's sample units, handles a partial
block with explicit zeros, and writes float output without loudness adjustment. It changes neither
the model nor its gains. This adapter is research, not the production denoiser.

The pinned source assembles a previous/current analysis window and explicitly
keeps another delayed spectrum. Before measuring, the hypothesis was two frames
(960 samples at 48 kHz), distinct from the demonstration program's one-frame skip.
The [timing harness](../../../../packages/test-harness/editing/rnnoise-timing.py)
appends two zero frames and retains exactly the requested count after that declared
offset. It never aligns peaks to choose an offset or reads excluded neighbors.
Each process has a 30-second deadline and the batch a two-minute deadline.

First/interior/final impulses retain authored peak locations and counts after
compensation; one-, seventeen- and 479-sample inputs also pass. The one-frame skip
negative control fails every case. This is **position evidence only**: a 0.5
impulse becomes approximately 0.0033–0.0042, so the model removes most of its energy.
That behavior neither proves nor disproves protected-phoneme quality.

The real extract retains all 240,000 input samples. Omitting flushing delivers only
239,040 after the declared offset and fails count preservation. Four zero-tail
frames instead of two, and a repeated fresh process, reproduce the compensated
speech bytes exactly. The largest speech peak changes position because its
amplitude ranking changes; that is not used as a speech latency estimate.

[Report](report.json), [preparation](preparation.json) and [initial cases](initial.json)
retain commands, hashes and measurements. `speech-selected.f32` is mono 48 kHz
little-endian float PCM with no audition normalization. The confirmation batch took
about 0.44 seconds on this host; no broad performance claim follows. Inference ran
under network denial. No listening or full speech-quality acceptance occurred.

Build the driver using `preparation.json` from the pinned prepared RNNoise checkout,
then run with a fresh output directory:

```sh
python3 packages/test-harness/editing/rnnoise-timing.py --processor /tmp/screenrec-rnnoise-api --speech specs/agent-editing/assets/18-voice/context.wav --ffmpeg /opt/homebrew/bin/ffmpeg --out /tmp/rnnoise-timing-fresh
```

Next compare matched known-noise mixtures and protected speech, preserve edit-input
isolation and pure-split state, and obtain independent listening evidence. Exact
counts and an impulse's remaining peak cannot replace any of those requirements.
No production model, strength, channel policy or state strategy is selected.


Shape/diff/docs review retains one small frame adapter and one numerical harness;
there is no product dependency, model downloader or denoise stage. Independent
review found no actionable defects and checked source/output hashes against the
report. Its attempted rerun was blocked by nested sandbox execution, so the actual
unrestricted confirmation above owns runtime evidence. Local review log:
`/tmp/screenrec-rnnoise-timing-review.log`.

## State across selections and splits

The [state report](state-report.json) extends the same frozen processor and delay
compensation. Before the trial, the hypothesis was that excluded input must be
removed before the learned state sees it, while independently restarting each
piece of a pure split would change the sound. Comparisons require exact float
PCM equality and exact counts; no speech-quality threshold is inferred.

Replacing every excluded prefix/tail sample with alternating ±0.9 values leaves
the selected-input output identical. Processing the entire poisoned source before
cropping changes every one of the 144,000 kept samples, with maximum absolute
difference 0.036415. Independently processing the two unchanged halves changes
72,960 samples, with maximum difference 0.005516. Thus this candidate also rejects
both process-before-selection and independent reset-per-clip as general edit
policies. This is measured state sensitivity, not a listening verdict.

A fresh confirmation reproduces every raw output hash and these comparisons.
The retained `kept-raw.f32` includes the declared front delay and flushed tail;
the report supplies the selected source range and frame counts. The initial and
confirmation scratch directories are `/tmp/screenrec-rnnoise-state-trial` and
`/tmp/screenrec-rnnoise-state-confirm`. The reproduction command above runs the
state cases as well as all prior timing cases. Each process and batch retain the
existing 30-second and two-minute deadlines. No production state policy, channel
policy or backend is adopted.

Independent review found no actionable defects, recomputed the state comparisons
and checked all 31 trial/confirmation artifact hashes plus retained output and
processor identity. A fresh reviewer execution was blocked by nested sandbox
restrictions; the root confirmation supplies actual runtime evidence. Review log:
`/tmp/screenrec-rnnoise-state-review.txt`.
