# 23a — Validated optional speaker evidence

Status: open. Exact original-checkpoint research passes the bounded acoustic gate;
production runtime/dependency integration remains unselected and unimplemented.

## Frozen independent acoustic cohort

The [protocol](../evidence/speaker-cohort/frozen-protocol.json) and original
[selection/RTTM](../evidence/speaker-cohort/selection.json) freeze six 30-second
VoxConverse v0.3 windows before inference: three official development and three
untouched official test cases. Selection uses only original corrected human
speaker intervals, with two to four anonymous speakers, overlap and silence.
The [paper's manual verification](https://arxiv.org/abs/2007.01216) explicitly
corrects automatic intervals after watching/listening, targeting boundaries within
100 ms. This is independent acoustic speaker support, not AMI transcript padding
or human word-boundary authority. Zero collar and overlap scoring stay unchanged.

Reuse both exact prepared 22 binaries/models/settings without copies, tuning or
new model acquisition. Audit range extraction, original RIFF and exact sample
clocks first. Compare development cases serially; only a candidate passing every
development case and cost may reach untouched confirmation, chosen by pooled DER.
Every confirmation case and pooled speaker-time DER must be at most 20%; an
average cannot conceal a failed window. No qualifying development candidate means
no provider selection and confirmation remains unscored. These stricter guards do
not reinterpret the retained failed AMI results or prove why they failed.

No product persistence/operations or provider license resolution follows from
this research. The root Sortformer variant's lineage ambiguity remains; RSS
excludes CoreML/ANE services, unknown-assignment confidence is untested, and
VoxConverse identity population/training overlap limits general claims.

## Default cohort result and next calibration

The [independent acoustic research](../evidence/speaker-cohort/README.md) retains
four exact cached-provider calls. Neither candidate qualifies; no confirmation
inference occurred and no product provider is selected. Community source-clock
padding is explained and mapped under a separately frozen protocol, retaining
its raw invalid failure; its adapted quality still fails. No average overrides
a failed development case. The research map owns measured outcomes and budgets.

The separately [frozen Community1 calibration](../evidence/speaker-calibration/README.md)
uses only development windows, documented knobs and immutable cached models.
Its same-default configurable wrapper control preserves the original segments;
all four frozen recipes fail an every-case gate. No recipe reaches untouched test
windows. Keep these null and partial effects in the research map; another grid
cannot substitute for a different justified hypothesis or provider. Those recipes remain failed evidence, independently of source/model licensing.

## Exact original checkpoint result

The [official original NeMo reproduction](../evidence/speaker-original/README.md)
uses a separately frozen exact checkpoint and native high-context recipe. All
three development and three calibration-untouched confirmation cases pass the
unchanged every-case quality, cost and source-support gate. Pooled confirmation
DER is 13.432%; no endpoint adapter or quality tuning was needed. VoxConverse
v0.3 is explicitly in model training data, so this is never training-held-out.
Different artifact/runtime/recipe choices confound comparison with the retained
converted/CoreML failure; no conversion defect is established.

Before production implementation, freeze a small integration slice retaining
this exact original recipe and mapping dependencies into existing optional
voice/model preparation, runtime and jobs owners. Research does not select a
separate Python installer/service, bundle NeMo dependencies or authorize implicit
model downloads. Preserve the actual NVIDIA license and source/model receipts.

The first production checkpoint is [23a1](23a1-speaker-runtime.md): exact original
30-second prepared-input/runtime preservation through existing preparation and
worker owners. General ranges and durable source/public projection require the
following contract to be resliced after that seam; they are not silently included
in runtime readiness.

## Implementation contract after a passed gate

Use existing model preparation/runtime/jobs and core source evidence generation.
Persist additive source/channel intervals, confidence/model/generation, explicit
unknown assignment and overlapping speaker support. Never rewrite transcript
words or infer an edit. Existing composition projection maps exact source support
into partial, repeated and retimed project occurrences; typed CLI/MCP reads share
one meaning. Missing model reads do not download it.

## Proof before calling it implemented

One source plus repeated/retimed project evidence JSON proves original source pins,
overlap, unknown assignment, partial support, generation replacement and stale
pages. Pin the accepted provider and metrics from a passed research cohort; retain
actual runtime/model receipts. Reopen catalog/package compatibility decisions for
any incompatible persistence change. Existing library/package preservation must
pass. This source proof cannot establish general diarization quality or installed
release readiness. No personal recording/playback or automatic edits.
