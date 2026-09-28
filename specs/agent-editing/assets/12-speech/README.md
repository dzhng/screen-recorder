# Real narration speech evidence

Status: **baseline reproduced, cleanup acceptance incomplete**. Current local
Parakeet output exactly matches all 306 inherited words and their spoken ranges.
Against the fifteen independently marked visual edges, median error is 135 ms
and p95 is 578.1 ms. Both fail the unchanged 100/250 ms targets. The unmarked
sixteenth edge remains unmarked; it is not filled from the candidate transcript.

The [manifest](manifest.json) records native/model/source identities, raw worker
responses, timings, candidate observations and the two original/cut comparisons.
The [label packet](review-labels.json) preserves the original provenance instead
of promoting ASR proposals to truth. Full-corpus filler precision and recall are
null because no complete independent audible inventory exists. The one returned
`uh` is represented, but that observation cannot establish that other fillers
were not omitted. Likewise, repeated `return to it` text does not prove accidental
repetition or permission to remove it. Pacing intent remains unverified.

## What is independently supported

The inherited manual visual marks support acoustic boundary comparisons with
approximately ±25 ms annotation tolerance. They do not independently establish
all word spellings, fillers or editorial intent. The historical narrator audition
supports one exact `this is free` removal; it is not approval for these new cuts.
The scorer matches only a unique same-word edge within 1.5 seconds of a frozen
mark. An omitted, far-away or ambiguous match fails completeness rather than
improving the scored subset. Quantiles use the historical interpolated convention.

The native audio path removed the two explicit inherited ranges. The independent
[PCM verification](pcm-verification.json) confirms output hashes, sample counts,
and exact retained samples outside the known five-millisecond join ramps. This
proves the interval operation and protects bytes outside its footprint; it does
not prove that the chosen footprint preserves every intended word. Neighbor
names proposed by ASR and independently verified protected words are different
things, and the latter are still missing.

The filler and repetition spectrogram panels were redrawn using the existing
boundary harness and fresh transcript. Both are byte-identical to their historical
counterparts ([comparison](panel-comparison.json)). The filler end line still
precedes the inherited marked end by 100 ms. No new visual annotation or passing
boundary result is claimed. Independent visual acceptance remains open.

## Reproduce locally

Build the existing core package and native worker normally. Point all preparation
and outputs at scratch directories. Preparation is explicit; ordinary runs refuse
an absent/invalid model and never download it.

```sh
node packages/test-harness/editing/speech-reproduction.mjs --corpus real-narration --prepare --model-home /tmp/screenrec-speech-reproduction
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/speech-reproduction.mjs --corpus real-narration --model-home /tmp/screenrec-speech-reproduction --out /tmp/screenrec-speech-next
node --test packages/test-harness/editing/speech/boundaries.test.mjs
node packages/test-harness/editing/speech/verify.mjs specs/agent-editing/assets/12-speech
```

Use a fresh output directory: native publication refuses existing output files.
The model owner already pins FluidAudio/Parakeet assets; the runner reuses that
owner rather than maintaining another downloader or model manifest. Native calls
run under an OS network-denial sandbox. Source media stays in the checked-in
fixture; no personal library is inspected, changed or enrolled.

To reproduce the displayed panels without overwriting inherited marks:

```sh
node packages/test-harness/speech-boundaries.mjs --transcript specs/agent-editing/assets/12-speech/transcript.json --out /tmp/screenrec-speech-panels
```

The first preparation attempt failed with ENOSPC and cleaned its staging files.
After space recovered, one retry succeeded. The first offline native process took
63.02 seconds with 550,043,648-byte peak RSS; the frozen full-harness run took
51.43 seconds with 549,502,976-byte peak RSS for transcription. Both start a new
worker; neither is an in-process warm benchmark. Core ML emitted its existing
shape-inference warning but returned a complete transcript. Historical 1.7-second
resource figures are not substituted for these observed costs, nor is a cause for
the difference inferred from two loaded-host measurements.

## Next evidence work

Audition the bounded [filler original](filler-uh-54s-original.wav) and
[candidate cut](filler-uh-54s-candidate-cut.wav), and the
[repetition original](repetition-candidate-second-return-original.wav) and
[candidate cut](repetition-candidate-second-return-candidate-cut.wav). Record
actual target identities, accidental-versus-deliberate repetition, protected
neighbor words/ranges and both joins separately. The repeated-phrase cut is a
comparison candidate, not an accepted editorial decision. No speaker playback
was performed in this pass.

Expand the independent inventory to cover ASR omissions and measure full
precision/recall. The [matched real-narration verbatim comparison](../12-verbatim/README.md)
records the alternative on this same corpus; it remains research-only and fails
the unchanged timing/completeness gate. The next numerical experiment is separate
forced alignment on the frozen baseline text. Forced alignment cannot supply
missing semantic labels. No processing recipe is accepted for slice 12b.
