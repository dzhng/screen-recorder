# RNNoise local comparison contract

Research only. Compare a learned speech denoiser with the conventional candidate;
no processor/model is adopted by this experiment. Pin RNNoise source commit
`70f1d256acd4b34a572f999a05c87bf00b67730d` and its upstream model archive SHA-256
`0a8755f8e2d834eff6a54714ecc7d75f9932e845df35f8b59bc52a7cfe6e8b37`.
The [upstream README](https://github.com/xiph/rnnoise/blob/70f1d256acd4b34a572f999a05c87bf00b67730d/README)
requires mono 48 kHz input for its example. Its build downloads model data;
preparation is explicit in scratch, before offline evaluation.

First inspect and run the unchanged example on the retained five-second narration
and room tone, both decoded to the same 48 kHz PCM convention. Preserve raw output
length, levels, timing and hashes. The example's skipped first block and discarded
partial input are not accepted editorial semantics. Establish that baseline before
changing any wrapper or compensation. A lower noise level cannot establish speech
quality; clean/noisy mixtures, endpoints, stereo, edited state, protected phonemes
and independent listening remain required by slice 12c.

Preparation gets five minutes and one build repair. Each inference gets thirty
seconds; the first two-input numerical batch gets two minutes. Pin executable,
model, source, compiler, input/output identities. No training, user capture,
speaker playback, installed-app change or product dependency is authorized by
this research checkpoint. Keep outputs local and preserve the failed controls.


## Observed baseline

The pinned example completes offline under network denial. Code is unchanged;
the local adaptation compiles the source list from `Makefile.am` directly with
Clang and the default `DISABLE_DEBUG_FLOAT` setting, because Autotools is absent.
The 58,603,099-byte upstream model archive matched its declared SHA-256 before
extracting the default C data/header. The [preparation record](preparation.json)
pins source files, flags and compiler; source license is retained separately.
Model/product distribution review remains a later adoption requirement.

| Input | Input / output frames at 48 kHz | Raw RMS change | Count gate |
| --- | --- | --- | --- |
| Five-second narration | 240,000 / 239,520 | −3.34 dB | Fail |
| Room tone | 43,200 / 42,720 | −31.17 dB | Fail |

Neither output clips, but this says nothing about lost consonants or introduced
artifacts. The room-tone reduction is useful mechanism evidence; the speech level
change is not a quality improvement. Do not directly rank it against the earlier
24 kHz float conventional baseline: this example requires 48 kHz signed-16 input.
Both outputs lose one 480-sample block. Upstream code skips the first processed
block and never flushes at EOF; the shorter output is not accepted as a harmless
format difference. First-run elapsed time including sandbox startup was 0.444 s,
second 0.0162 s; maximum resident size was 5,144,576 bytes for each. Those are two
single local processes, not a broad speed or memory guarantee.

The [report](report.json) contains input/output hashes and exact offline/decode
commands. Retained `.s16` outputs are mono 48 kHz little-endian signed-16 PCM;
raw resource logs accompany them. No loudness normalization or speaker audition
was performed. Reproduce against the pinned prepared repository/binary with:

```sh
python3 packages/test-harness/editing/rnnoise-baseline.py --demo /tmp/screenrec-rnnoise-demo --repo /tmp/screenrec-rnnoise-research --ffmpeg /opt/homebrew/bin/ffmpeg --speech specs/agent-editing/assets/18-voice/context.wav --noise specs/agent-editing/assets/18-voice-roomtone/room-tone.wav --out /tmp/rnnoise-baseline-fresh
```

Next: use the public frame API in a separate bounded wrapper, test explicit
zero-tail/block handling and exact counts without borrowing excluded samples,
then compare matched clean/noisy speech and conventional output. The unchanged
example remains the baseline; no listening or endpoint-quality gate passes here.

Focused shape/diff/docs review keeps preparation and inference in research tooling,
with no production dependency. Independent review found no actionable defects and
verified retained output hashes and sample counts; it did not repeat model
inference or listening (`/tmp/screenrec-rnnoise-review.log`).

## Next API timing hypothesis

The pinned `rnnoise_process_frame` uses the previous analysis window and a second
explicit delayed spectrum. Test the source-derived two-frame (960-sample) latency
hypothesis against the one-frame skip in the example. A separate float adapter
will process the public frame API, preserve partial input with zeros, and append
two zero frames; the evaluator will retain exactly the selected count after the
declared 960-sample offset. Do not find the offset by fitting observed peaks.
Start with first/interior/last impulses and a very short selection. Count success
alone cannot establish preserved speech or justify adopting this wrapper.

[Frame API confirmation](../12c-rnnoise-timing/README.md) now tests that hypothesis
with negative controls; speech quality and adoption remain open.
