# 22 — Local speech evidence feasibility

Status: original speaker recipe passes bounded research; event recipes failed and
boundary authority is pending. Public family implementation remains gated. Question: **Which local providers earn speaker, acoustic-event and boundary claims?**

Dependencies: existing contracts only.

## Contract and owner

Existing local models/preparation/runtime plus labeled research evidence.

Evaluate diarization, acoustic events and boundary alignment as three independent bounded experiments. Freeze candidates/licenses, held-out labels, quality/abstention metrics and memory/runtime budgets before evaluation. Synthetic data tests mechanics only. No hosted substitution. Provider choice is outcome, not implementer preference.

## Focused proof and review

Model-specific quality/cost/coverage report per evidence family.

Real overlap, unknown speaker, short reaction/laugh/applause, silence and word edges. Separate speaker attribution error, event precision/recall and boundary error. Pin labels/models/runtime and disclose unsupported categories. A failed family remains unfinished or resliced, never quietly dropped.

## Independent family verdicts

- [x] Diarization: exact original checkpoint/native recipe passes the bounded
  quality/cost gate; relocated runtime and public evidence remain in23a1/23a.
- [ ] Acoustic events: separate labeled gate, accepted categories and provider or explicitly unfinished.
- [ ] Boundary alignment: separate error/coverage gate and provider or explicitly unfinished.

A pass for one family cannot close another. Before slice 23 pickup, materialize one implementation sub-slice per passed family, with its frozen provider/metrics and source-projection contract. Record failed families as unfinished scope.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.


## Frozen initial research gates

The parent accepted these proposed numerical gates before candidate evaluation,
as bounded initial scope rather than general accuracy. Each family stands alone.
No confirmation case is tuned or discarded after seeing results. Retain complete
labels/raw candidate outputs, exact corpus/model/runtime identities, category
denominators, failed attempts and uncertainty.

- Speaker diarization: at most 20% diarization error rate (missed speech, false
  speech and speaker confusion), with overlap scored and speaker confusion shown
  separately. Retain unidentified speakers and overlap without guessing names.
- Acoustic events: precision at least 0.90 and recall at least 0.70 independently
  per accepted category. Laughter, applause and short reactions cannot borrow one
  another's scores. Missing/unsupported categories remain unfinished.
- Boundary alignment: at least 95% matched word coverage and 95th percentile
  absolute endpoint error at most 50 ms, using independent word and full neighbor
  labels. Candidate-generated or inherited ASR timing is not reference truth.
- Cost: peak process RSS at most 4 GiB and inference wall time at most twice audio
  duration. Report cold startup separately; tiny-scope resource claims apply only
  to the measured workload and runtime. Initial scope is 3–6 bounded real clips
  per family, not a statistical general-accuracy claim.

This slice researches providers; no source/catalog/operation contract changes
are authorized by a quality score. A passed family materializes its own 23
implementation sub-slice. A failed/pending family stays open or is resliced.

Research starts with the existing pinned FluidAudio source
`41540ea237350afe5117a082b5c28eda642d0612` (0.15.7) as the diarization candidate.
Its offline Community-1 conversion model repository is pinned to
`FluidInference/speaker-diarization-coreml` revision
`df2625ac79a7ac6b65ad868fee6d80f320da4232`; its NOTICE explicitly grants scoped
CC BY 4.0 for the exact supported Community-1 artifacts, excluding legacy models.
No model is chosen for production until the local labeled gate and exact runtime
provenance pass. No hosted inference or fallback provider is permitted.

AMI corpus mirror revision `722d8891643e1e4dc62cfd0d198fa05a1646c3cc`
is CC BY 4.0, with its retained archive license controlling actual redistribution.
A pre-evaluation inspection found its word timestamps are forced-alignment
outputs, despite the archive's manual-annotation name. The internal README names
known timing errors. Transcriber segment times may supply speaker labels; these
word timestamps must never be promoted as independently listened human word
boundaries. Existing frozen human marks cover eight endpoints on four words from
one source, which cannot establish full neighboring-word coverage.

Delegated threshold choice — sound, medium confidence. The plan did not give
quality or cost numbers. The agent proposed the above bounded gates, and the
parent accepted them before model evaluation. For example, a provider that labels
laughter well but misses applause cannot pass an aggregate average: applause
stays open. These numbers decide promotion for this first corpus only; future
coverage requires new independent gates rather than retroactively loosening
limits to accept an observed result.


The pre-inference [frozen protocol](../evidence/speech-feasibility/frozen-protocol.json)
selects three AMI meeting windows using only independent segment labels, and six
FSD50K evaluation files (two each laughter, applause and gasp, mutually absent
other target labels). Gasp is a named acoustic reaction only; it cannot stand for
all semantic/emotional reactions. Whole-clip event presence at fixed 0.5 maximum
frame score is an initial diagnostic, not an event-interval accuracy claim.
The YAMNet candidate is the Apache 2.0 declared copy of Google's YAMNet1 TFLite
model at `thelou1s/yamnet` revision
`156527da8fb34f53a3798d6011810fa975738062`, running local LiteRT 1.2.0. No threshold
or clip changes occur after inference. Individual FSD50K audio licenses override
the dataset card; only selected CC0/CC BY files are used.


## First frozen cohort: fail, retained before alternatives

The [initial report](../evidence/speech-feasibility/report.json) retains all six
event outputs (including complete score arrays) and all three diarizer outputs
with independent labels. Community-1 failed the 20% gate: 46.42% speaker-time-weighted
DER across 55.879 reference speaker-seconds; 18.873 missed, 6.888 confused, 0.176 false
speaker-seconds. All three windows failed separately. Reference overlap is 7.682 s;
reference silence is 42.027 s. Process RSS 187–203 MB and inference 0.18–2.30 s per 30 s
passed cost; first model load 2.68 s and later cache-warm loads ~0.06 s are distinct
cold process observations, not repeated no-cache cold benchmarks.

YAMNet failed all category gates at frozen 0.5: laughter 0/2, applause 0/2 and
gasp 1/2 recalled, with no false positives in the four other-category negatives
per target. Precision is undefined where no detection occurred; it is not 100%.
Gasp precision 1 does not rescue recall 0.5. These are presence diagnostics only.

The [independent input validation](../evidence/speech-feasibility/input-validation.json)
re-fetched every native PCM window, verified HTTP Content-Range against requested
byte offsets, parsed every original RIFF header and matched retained bytes exactly.
All native sources are mono 16 kHz PCM16, with data offset 44; no channel mixture or
resampling occurs. Events preserve original WAVs, with once-only explicit FFmpeg
mono 16 kHz conversion and recorded original/prepared hashes. Annotation times are
AMI's transcriber_start/transcriber_end in the meeting clock, clipped at exact
selected second offsets. These include human transcript padding. Published SDK
DER uses different forced-aligned RTTM, 250 ms collar and ignores overlap; it is not
a comparable baseline. Frozen labels/gates are unchanged after validation.

Alternative hypothesis queue: one independent existing-SDK Sortformer model
may preserve overlapping speaker activity better than embedding clustering on
short windows; one PANNs Cnn6 event model may generalize to the selected short
FSD50K effects better than YAMNet. These are new separately frozen providers,
not threshold changes to the failed cohort. Current cases remain untouched
confirmation operands. Boundary alignment still requires independent complete
human word-neighbor labels; forced-alignment outputs cannot fill that gap.


## Alternative verdicts and unresolved scope

The [Sortformer report](../evidence/speech-feasibility/sortformer-report.json)
failed the unchanged 20% aggregate DER gate at 47.46%. Its three windows were 74.15%,
18.24% and 59.34%; one passing window cannot close the family. Confused support
fell to 1.520 speaker-seconds, while missed support rose to 24.639 and false support
to 0.360. It changed the error mix rather than solving the contract. Process RSS
529–538 MB and inference 1.52–3.13 s per 30 s passed scoped cost. First cold load 61.71 s
and later cache-assisted fresh-process loads ~2.06 s are reported separately.
The root compiled model's metadata names MIT while its repository card declares
CC BY 4.0 and refers to newer variants. The executed bytes/shapes are pinned,
but this root variant's upstream weight lineage needs resolution before any
redistribution or product selection; no v2.1 quality claim is made.

The [PANNs report](../evidence/speech-feasibility/panns-report.json) also failed
all unchanged event gates: laughter 0/2, applause 0/2, gasp 1/2 recalled. Its official
MIT code and CC BY 4.0 checkpoint are source-pinned; the downloaded checkpoint's
MD5 matches Zenodo and SHA256 is retained. CPU inference 0.014–0.114 s and process
RSS 0.52–1.15 GB passed cost. The first import/frontend startup was 11.99 s, later
fresh-process startups ~0.93–0.98 s with host caches. Its clipwise score and YAMNet's
maximum-frame score are distinct frozen provider recipes, both scoped to presence.
No category threshold or case changed after either run. Neither establishes event
boundary quality or arbitrary short/emotional reaction semantics.

Boundary alignment was not inferred: independently listened complete neighboring
word labels are unavailable. AMI word times are forced-alignment output. Existing
frozen human marks are sparse; their historical p95 ~104 ms is a narrow diagnostic,
not a current full-coverage evaluation or provider selection. New recordings are
not required; a separate annotation/evidence pass on existing real material can
resolve the missing authority.

The family-specific follow-ups are [speaker evidence](23a-speaker-evidence.md),
[acoustic events](23b-acoustic-events.md) and [boundary evidence](23c-boundary-evidence.md).
Public implementation remains gated/open. No optional speech operation or model is advertised.

The [independent temporal event cohort](../evidence/event-temporal/README.md)
adds human 100 ms scene-occupancy labels and separate development/confirmation
windows. Laughter fails development; Clapping's frozen threshold passes development
but fails confirmation. Applause and Gasp have no reference in that cohort.
The scene-to-MIC-channel-zero projection was frozen before inference but not
independently listened; these are failed coarse-occupancy experiments, not precise
event endpoints or an isolated diagnosis of model versus projection error.

## Accepted original speaker recipe

The later [official original checkpoint reproduction](../evidence/speaker-original/README.md)
passes every bounded development and confirmation window at the frozen gate,
including overlap with zero collar. Its exact checkpoint, original native recipe,
raw outputs and runtime operands are retained; the earlier converted/provider
failures above remain valid. This selects the preserved computational recipe,
while clean relocation, model preparation and public source/project evidence are
separate [23a1](23a1-speaker-runtime.md)/[23a](23a-speaker-evidence.md) gates.

Confirmation was untouched by our calibration, but the model card lists this
corpus version in training data. This is neither a training-held-out accuracy
claim nor calibrated known-person recognition. Event categories and word-boundary
authority remain independently unfinished; the speaker pass cannot close them.

## Reproducibility and evidence boundaries

Original event files, exact AMI PCM windows and original selected speaker XML
are preserved losslessly in [source operands](../evidence/speech-feasibility/source-operands.tar.xz),
with per-member [hashes/licenses/attribution](../evidence/speech-feasibility/source-operands.json).
Both model inventories, complete score outputs, raw predictions, fixed protocols
and [actual runtime identities](../evidence/speech-feasibility/runtime.json) are
retained. Models and third-party source were downloaded only into one shared
research cache; they are not bundled as a product dependency.

The [research harness](../../../packages/test-harness/speech/feasibility/README.md)
uses explicit local files, independent labels and network-denied inference.
A private Swift package used the pinned SDK archive, disabled its unrelated optional
text-normalization trait and built with two jobs; it never changed the read-only
HEVC runtime or another checkout's build. Python providers ran in a private venv
over the identified interpreter; dependency versions are retained. Process RSS
excludes out-of-process CoreML/ANE services and is not a total-machine memory claim.
No audio played, capture/transcription demonstration, user-media edit or full suite.
The native alternative wrapper first failed to compile because an upstream README
used a stale `segments` property; the current `finalizedSegments` API fixed it.
The failed spawn produced no quality output and is an infrastructure attempt,
not a model error score. No failure was repeated unchanged.

Two focused scorer tests passed. The first overlap test was red before the scorer
existed; its control establishes missed/confused speaker-time accounting and
global anonymous-label mapping. Deliberately breaking event thresholding caused
the expected category false negatives, then passed after restoration. These
synthetic intervals test metric mechanics only; all provider quality inputs are
real independently labeled corpus audio. Narrow native builds and output reads
proved the wrappers, not product installation/readiness.

## Parameter-effect map and next experiment

| Frozen strategy | Observed effect | Limit and next useful test |
| --- | --- | --- |
| Community-1 overlapping output, threshold 0.7 | DER 46.42%, confusion 6.888 s | Short-window transcript-padding labels; validate tighter independent speaker support on untouched real clips, preserving overlap and unknown identity. |
| Sortformer embedded-matching default | DER 47.46%, confusion 1.520 s, miss 24.639 s | Different error mix; one case passes. Resolve exact variant provenance and test a separately frozen untouched cohort with independently verified acoustic speaker support. |
| YAMNet, maximum-frame 0.5 | Laugh/applause recall 0, gasp 0.5 | Presence only; separately calibrate per-category probabilities on development data, then freeze thresholds before untouched confirmation. Current cases cannot become a tuning set and still certify confirmation. |
| PANNs Cnn6, clipwise 0.5 | Same category recall failures | More startup/memory than YAMNet; retained minority-event examples motivate a dedicated event/taxonomy study, not relaxing current gates. |
| Existing sparse human boundary marks | Complete word-neighbor authority missing | Bind complete independent annotations on existing real speech before comparing local aligners. |

The [choices ledger](../choices.md) owns corpus authority, retention,
whole-clip diagnostic scope, overlap settings and calibration separation.
Family follow-ups remain research-gated; public human-corrected speaker and event
annotations offer new candidate cohorts, while boundary-label access/retention
still needs its own admitted fixture. No failed provider is shipped.

Unknown-person recognition and confidence calibration were not evaluated. All
speaker IDs are anonymous local cluster/slot labels; optimal reference matching
exists only for score accounting and never names a person. Missed/unmatched
reference support stays an error. An explicit unknown-assignment contract remains
part of 23a and cannot be inferred from this anonymous-ID experiment.

Closeout shape review kept metric arithmetic separate from provider invocation
and source evidence; no worker, cache, acquisition, service or publication owner
was added. Code review checks research outputs/claims, not production readiness.
Documentation flows through the speech protocol into the research harness, while
family follow-ups remain separately reachable through 23. Focused metric tests and
changed-file lint/format/whitespace checks passed. No expensive provider rerun is
needed when only docs/formatting change.

Independent Codex review found no actionable defects. It reran the focused scorer
tests and recomputed retained metrics from raw predictions, verified complete
event arrays against summaries, checked archived source hashes and reconstructed
reference clocks from original XML. Native inference was not rerun. The concise
[review receipt](../evidence/speech-feasibility/code-review.txt) records that scope.
