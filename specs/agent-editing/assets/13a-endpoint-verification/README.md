# Exact stretch endpoint verification

Research contract, protocol 1. The unchanged frozen Signalsmith exact recipe is
still the numerical candidate; this pass cannot adopt it into production.
Corrected full-support measurements in [13a-support-review](../13a-support-review/README.md) are the baseline.
Every loaded PCM must match its frozen hash before plotting. Missing isolated
endpoint outputs may be regenerated with the pinned C++/headers, then must match
the corrected report hashes. Existing outputs are reused, not recomputed.

The first cheap test derives request admission from upstream `outputSeekLength`
and checks boundary requests. Admission and audio quality are separate: equal
frame counts use identity; nonunit requests require the selected frame count to
cover the exact recipe's seek length. There is no global duration minimum or
implicit small-block fallback. The unchanged pitch gate requires an available
estimate with error below 1%; unavailable is not a pass.

Planned hypotheses, in order:

1. The corrected isolated output hashes reproduce with the pinned recipe. Test
   one leading impulse first, then recover the missing isolated cohort. Failure
   stops plotting; successful recovery enables full-support and ±100 ms panels.
2. Exact admission depends on both selected count and rounded output count.
   Check one frame below/at/above each inferred boundary for frozen speeds and
   default/256-sample blocks. This establishes capability, not quality.
3. The 256-sample block's short 1 kHz success does not establish speech-pitch
   quality. Try a 100 ms, 120 Hz tone first against the unchanged <1% rule;
   expand only if that cheap test resolves an informative contrast.
4. Real phrase joins need direct auditions. Freeze all seven paired manual outer
   phrase marks with explicitly authored 25 ms outward guards, plus a separately
   labeled whole LibriSpeech utterance. Preserve every unselected sample and
   poison excluded context to prove isolation. Existing marks have ±25 ms visual
   uncertainty and ASR word names; they are not independent word-span labels.

Each subprocess is limited to 60 seconds and each PCM selection to the existing
60 second native limit. No live recording, speaker playback or production
changes. Final confirmation includes complete endpoint panels, matched tone
scales, independent visual review and retained join auditions. Listening and
complete protected-word acceptance remain unverified until independently judged.

## Findings and capability boundary

The pinned recipe, dependency headers and all recovered isolated output hashes
match the corrected report. The older `/tmp/screenrec-signalsmith-frozen` cohort
is **not** the identity-bypass recipe: its unit-speed hashes fail the admission
check. Matching retained inputs came from `/tmp/screenrec-signalsmith-identity`.
The failed attempt left both historical directories unchanged.

| Factor | Measured result | Consequence |
| --- | --- | --- |
| Full-support isolated endpoints | Every regenerated exact/tail hash matches the corrected baseline | Complete-file and ±100 ms plots can replace the censored views; neither proves speech quality |
| Selected/output frame counts | Below/at/above seek boundaries agree at each nonunit rate for both frozen blocks | Admission is request-specific; a global minimum duration would hide valid requests |
| Equal counts | One-frame and speech selections return bit-identical PCM | Identity is a separate capability, independent of seek length |
| 256-sample block, 100 ms at 120 Hz | Four pitch estimates available, worst error 0.4153% | Passes this synthetic task only; does not establish speech naturalness |
| Same block, 10 ms at 120 Hz | All requests render; zero or one positive crossing in the estimator's middle half | Pitch evidence unavailable, including the identity control; no quality pass or automatic fallback |
| Guarded real phrase joins | Exact count, finite PCM, poison isolation and untouched context pass | Numerical join invariants pass; independently protected whole words and listening still need review |

For the pinned nonidentity recipe, upstream `outputSeekLength` returns the integer
truncation of `inputLatency + float(N/M) * outputLatency`, with Float32 arithmetic
and actual requested output count `M`. The selected count `N` must cover that
seek length. Boundary probes validate the compiled recipe, not a new production
implementation of the formula. Any future capability response should report the
actual counts, chosen recipe and explicit unsupported result before publishing
media. It must not silently expand selection, switch windows, pad output or alter
duration. Quality acceptance remains a separate gate; successful admission is not
permission to offer a short-window preset as accepted speech processing.

## Auditions and provenance

[The cohort report](joins.json) owns authored sample ranges and every output hash.
Seven narration selections use both existing manual outer phrase marks with an
explicit 25 ms outward guard, rounded outward to samples. The guard is part of the
selected range before rendering, not hidden processor context. Word names come
from ASR; the hand-read edges have about ±25 ms uncertainty and do not label
complete first/last words or protected neighbors. One clean whole-utterance control
uses [the retained LibriSpeech provenance](../12c-clean-reference/README.md);
its transcript names MISTER and GOSPEL but provides no sample-exact word bounds.

All reference and rate auditions remain in the scratch directory recorded by the
report. Representative original/0.8×/1.25× files for the opening phrase, short E2
phrase and clean utterance are retained in `auditions/`. No playback, listening
acceptance, word-preservation acceptance or production adoption is claimed.

## Reproduction and remaining decision

Run the evidence recovery with the original native input directory and matching
identity-bypass Signalsmith directory. Then run the join cohort and plotter:

```sh
node packages/test-harness/editing/stretch-endpoint-evidence.mjs /tmp/screenrec-stretch-frozen /tmp/screenrec-signalsmith-identity /tmp/stretch-endpoint-fresh
node packages/test-harness/editing/stretch-join-cohort.mjs /tmp/stretch-endpoint-fresh /tmp/stretch-joins-fresh
uv run --with matplotlib==3.10.8 --with numpy==2.3.5 python packages/test-harness/editing/stretch-endpoint-plots.py /tmp/stretch-endpoint-fresh/evidence.json /tmp/stretch-plots-fresh /tmp/stretch-joins-fresh/report.json
```

The JSON reports and plot manifest retain artifact/tool identities. No vendor or
production source changed. The independent visual review evaluates only the
complete captured numerical evidence, not listening quality. Next obtain scoped
listening judgments on original versus slowed/sped joins, then independently mark
complete protected word spans on the relevant real sources. Until that gate is
resolved, slice 14 may design the request/capability seam but must not adopt this
recipe or substitute whole-phrase-only support for the requested local edits.

[Review and choices](review.md), [verification](verification.json), and
[attempt ledger](attempts.json) retain the closeout and open evidence limits.
