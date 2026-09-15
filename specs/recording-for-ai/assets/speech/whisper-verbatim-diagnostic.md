# WhisperKit decoding-configuration ablation for verbatim fillers

The [natural speech diagnostic](natural-diagnostic.md) recorded that the pinned
WhisperKit large-v3-turbo runtime emitted **zero** `um`/`uh` across four AMI clips.
This asks whether that is fixable from the supported decoding surface alone. Two
configurations were run on the same four clips, offline, against the same runtime,
model and tokenizer hashes, and scored with the same token-alignment method.
Counts, commands, hashes and raw-output paths are in
[whisper-verbatim-diagnostic.json](whisper-verbatim-diagnostic.json).

## What changed

Both configurations differ from the prior baseline by exactly one added flag.
Neither prompt contains any clip transcript, reference sentence or expected word
sequence — only generic filler vocabulary or a style instruction.

| configuration | added flag | emitted `um`/`uh` | matched reference `um`/`uh` | false fillers |
| --- | --- | --- | --- | --- |
| baseline | *(none)* | 0 | 0 / 185 | 0 |
| C1 verbatim instruction | `--prompt "Verbatim transcript. Include every filler word, hesitation, repetition and false start exactly as spoken."` | 0 | 0 / 185 | 0 |
| C2 filler-style prompt | `--prompt "Um, uh, so um, yeah, I mean uh, you know, um, like, uh, well um, okay uh, right um."` | 91 | 83 / 185 (44.9%) | 8 |

**C1 changed nothing.** Instructing the decoder in prose left filler emission at
zero and made the transcript slightly worse: non-filler reference deletions rose
from 89 to 120, and on the two shortest clips the output text was byte-identical to
baseline. Whisper's prompt is previous-text conditioning, not an instruction
channel, and it behaves like one here.

**C2 recovered 83 of 185 reference fillers, and did so without inventing them
from silence.** Its 8 false fillers are not free insertions — there were zero of
those. Five replaced a reference content word (three of them `yeah` → `uh`/`um`,
plus `a` → `uh` and `if` → `uh`) and three are `um`/`uh` swaps against a reference filler.
Overall token error rate against the AMI reference fell from 0.457 to 0.325, and
non-filler deletions fell from 89 to 85 — a total that already absorbs the 21
non-filler tokens lost to the empty clip below — so the recovered fillers did not
come at the cost of content.

## What C2 broke

On clip `ami-ts3003c-b-02` (11.6 s, 31 reference tokens) C2 returned an **empty
transcript**: zero segments, zero words, every reference token deleted, token
error rate 1.000. Baseline and C1 both transcribed that clip. The upstream report
retains no per-segment metadata for a window that was never emitted, so this
diagnostic does not establish which decoder gate discarded it; the whole-window
skip in `SegmentSeeker.swift` is a candidate, not a finding. One catastrophic
failure in four clips is disqualifying on its own, independent of the filler win.

C2's long clip also truncates early and skips a stretch of content mid-clip, which
is visible in the retained text but not separable from ordinary deletion by this
method.

## Levers inspected and not run

Read from the pinned source before assuming any flag existed:

- **Suppression cannot help.** `suppressTokens` already defaults to `[]` and
  `suppressBlank` to `false` (upstream leaves `nonSpeechTokens()` commented out as
  a TODO), and the CLI exposes no `suppressBlank` flag. Nothing is suppressing
  fillers, so `--suppress-tokens` can only add restriction.
- **The quality thresholds never fired.** Every baseline segment reports
  temperature 0, `noSpeechProb` 0.0, compression ratio ≤ 1.82 (< 2.4) and average
  log probability −0.20…−0.57 (> −1.0). Relaxing `--no-speech-threshold`,
  `--logprob-threshold` or `--compression-ratio-threshold` cannot change outputs
  that no threshold rejected.
- **`--prefix` was rejected by construction.** It forces its tokens as each
  window's first output regardless of the audio, which is filler insertion by
  fiat, not recognition.

The runtime has no verbatim or disfluency option; `--prompt` is the only supported
lever that moved filler emission at all.

## The remaining fidelity problem

Even at its best, C2 still drops 90 of 185 reference `um`/`uh` and 19 of 23
truncated false starts, substitutes fillers over real words, and emptied one clip
outright. Prompt conditioning shifts this model's output style; it does not make
it verbatim, and the style that recovers fillers is the one that destabilised
decoding. Nothing here selects an engine, certifies timing, or advances the
acceptance gate, which still needs independently labeled filler boundaries and an
audition of the resulting cuts.
