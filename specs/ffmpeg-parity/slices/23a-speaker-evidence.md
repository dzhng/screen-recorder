# 23a — Validated optional speaker evidence

Status: open, gated by failed [22](22-speech-feasibility.md) provider experiments.
No provider or implementation is selected.

## Next bounded checkpoint

Validate acoustic speaker support on an untouched real corpus window with overlap
and silence. Independent transcriber segment labels include padding, and published
SDK scores use a different forced-aligned reference. Freeze the new label authority,
model lineage, no-tuning confirmation split and the unchanged 20% DER/cost gates
before another comparison. Keep miss, confusion, false speech and overlap
separate; anonymous speaker IDs are not recognition of known people. Resolve the
root Sortformer variant's conflicting lineage/license metadata before selection.

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
