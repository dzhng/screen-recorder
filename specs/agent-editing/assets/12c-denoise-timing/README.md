# Denoise latency compensation experiment

Research only; no production processor is adopted. The unchanged conventional
recipe and retained real narration remain the comparison parent. The first
question is whether explicit zero-tail flushing plus sample delay removal restores
endpoint timing without reading excluded neighboring audio.

The pinned [FFmpeg source](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavfilter/af_afftdn.c)
sets the hop to `floor(sampleRate / 80)` and its window to three hops. The output
window offset suggests a delay of two hops. This is a hypothesis about this
implementation, not a universal 25 ms audio-filter rule. At 44.1 kHz the predicted
integer delay differs from rounding 25 ms. The fetched pinned source SHA-256 is
`1958a27446c8d24af43f86784a58caed828f3f9a5f6f526e49b8c44ed13fe448`.

First test: unchanged recipe at 24 kHz, impulses at the first, interior and last
samples. Candidate appends exactly two hops of zero input, processes, then removes
two hops from the front and retains the requested count. Require exact count and
an above-1e-6 peak at the authored input index. The unchanged recipe must retain
its recorded delayed/lost endpoint failure. No output normalization is allowed.
If this passes, confirm at 44.1/48 kHz and on very short inputs, then vary upstream
packet sizes and tail length. Real narration comparison retains raw gain and
sample differences, without claiming listening quality.

Each ffmpeg command has a 30-second deadline; the bounded batch gets five minutes
and one infrastructure repair. Do not tune delay from observed peaks. A focused
pass keeps the mechanism for further study; promotion still requires the complete
12c speech, noise, channel, edit-isolation and listening gates. No model download,
capture, installed-app invocation or speaker playback is part of this experiment.

## Result and parameter effects

The timing hypothesis passes this numerical confirmation. All eighteen compensated
impulses retain their exact authored peak index and sample count, including first,
last and one-sample inputs at 24/44.1/48 kHz. Every unchanged negative control
fails timing. The 44.1 kHz compensation is 1,102 samples, not rounded 25 ms.
This recovers positions; it does **not** preserve impulse amplitude: the initial
24 kHz impulse falls from 0.5 to about 0.292, and the interior impulse to 0.467.

| Variation against compensated parent | Observed result | Interpretation |
| --- | --- | --- |
| Four-hop instead of two-hop zero tail | Exact speech PCM equality | Longer flushing adds no change on this extract. |
| Input packets of 17 or 997 samples | Exact speech PCM equality | These upstream packet boundaries do not reset filter state. |
| Repeated process | Exact speech PCM equality | Deterministic on this host/recipe/input. |
| Stereo versus separate channels, unequal impulses | Exact per-channel equality | Fixed-noise recipe preserves channel separation on this fixture. |

The five-second speech result retains 120,000 samples, peak 0.083697 versus input
0.087455, RMS sample error 0.0009898. That error is a raw waveform difference,
not an intelligibility or noise-reduction score. No normalization was applied.
The confirmation batch took about one second. The [report](report.json) pins
commands, executable/input/runner/output hashes and every result; [version](version.txt)
includes the linked FFmpeg library versions. All raw outputs remain in
`/tmp/screenrec-denoise-selected-final`; the retained `speech-compensated.f32` is mono 24 kHz little-endian
float PCM for subsequent matched comparisons. No output is an audition verdict.

Reproduce with a fresh output directory:

```sh
python3 packages/test-harness/editing/denoise-timing.py --ffmpeg /opt/homebrew/bin/ffmpeg --out /tmp/denoise-timing-recheck --speech specs/agent-editing/assets/18-voice/context.wav
```

The unchanged state experiment still rejects resetting per range or split. Next,
freeze an edited-input preparation policy and test poisoned excluded samples,
pure splits versus changed kept input, and range/full equivalence. Separately
compare clean/noisy speech and a learned alternative with protected phonemes and
listening. Timing compensation alone is not grounds for production adoption.

Shape/diff/docs review keeps this as one standalone research runner, with no
product dependency or processor path. The choices ledger records the reversible
zero-tail hypothesis. Independent `codex review --uncommitted` found no actionable
defects, reran the documented experiment successfully and checked runner/audio
hashes. Its scope was numerical reproducibility, not speech listening or edited
state. The full local log is `/tmp/screenrec-denoise-timing-review.log`.


## Selected-input follow-up contract

Keep the timing recipe fixed and test a middle three-fifths selection of the same
real extract. Replace only excluded prefix/tail samples with alternating ±0.9.
Trimming before processing must produce identical selected PCM; processing the
whole poisoned source and trimming afterward must reveal contamination. Reprocess
both halves independently as a negative control for the pure-split requirement.
This tests input ordering, not a production cache, lineage or context policy.
The same deadlines and no-promotion rule apply. Prior timing gates remain enabled.


The follow-up passes the exclusion-ordering check: all 72,000 selected samples
are byte-identical despite poisoned excluded neighbors. The intentionally wrong
process-before-trim path changes 14,810 samples (maximum absolute error 0.0155455).
Restarting independent filters at a pure split changes 3,841 samples (maximum
0.00410338), so compensation does not solve state continuity. All prior timing,
packet and stereo checks still pass. Use this result to preserve upstream-input
isolation in the future prepared-result owner; it does not verify that unbuilt
owner or authorize per-clip resets.

The follow-up's independent review found no actionable defects, reran the full
experiment and reproduced the selected-input results and identity hashes
(`/tmp/screenrec-denoise-isolation-review.log`). The existing exclusion and
pure-split requirements remain unchanged; no new production policy is selected.
