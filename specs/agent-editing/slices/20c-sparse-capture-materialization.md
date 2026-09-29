# 20c — Shared sparse capture materialization

Status: planned. Dependencies: [20b](20b-exact-capture-audio.md).

## Contract and owner

One capture-audio finalization owner reconciles exact accepted frame records with
physically decodable committed PCM, then materializes a canonical source-time MOV.
Both CaptureWriter normal finish and MediaRecovery call it; neither carries a
private repair algorithm. Keep the shared owner below ScreenRecorderWire in the
existing Capture/Media dependency direction. Reuse SourceSegment/container semantics
and extract reusable decode primitives if needed rather than copying recovery.

Input is an immutable packed payload plus a validated streamed journal prefix.
Output identifies the represented physical frame prefix, exact occupied/empty
source segments, diagnostics and canonical candidate. Source time comes from the
CaptureClock evidence established by 20b. No inserted silence, per-reader map,
second blob store or fitted source offset. Keep separate capture roles independent.

## Reconciliation and refusal

Missing journal mapping and missing physical bytes are different failures. Accepted
frames past actual decodable commitment are unavailable; payload frames without a
valid accepted mapping remain unpublishable. Clip a mapped final run only by exact
proven physical frames. An interior payload loss must not make later concatenated
decoder output look like the original physical address. Stop at the last provable
prefix unless trustworthy later addresses are independently established. Preserve
ambiguous tails and report why they were excluded; do not delete evidence on failure.

Coalesce exact runs from 20b and use the banked composition/passthrough mechanism.
Preflight exact representability of source placement, frame duration and container
timescale without overflow; unsupported precision refuses rather than quantizes.
Verify actual canonical PCM identities and exact segment placement before declaring
the candidate valid. Endpoint/packet-count checks or a successful export alone are
insufficient. Physical payload must contain the original samples without gap padding.

## Bounded work gate

Stream journal records and physical decode with fixed working buffers; do not
retain per-packet arrays. One active run is sufficient while coalescing. Budget the
platform composition's retained segment metadata explicitly, measure work/RSS as
run count grows, and preflight the supported bound before export. Use existing
attempt/cancellation/retention ownership for any spill or resumed work; no generic
new job framework. The current acquisition interval ceiling is an outer contract,
not proof that a platform composition at that size is safe.

The experiment's eight runs, 30 seconds and 16 MiB are **not product limits**. Choose
production working bounds from measured normal and fragmented long-take cases;
record the resource/behavior tradeoff before enablement. On exhaustion preserve
working data and return an actionable refusal rather than silently dropping runs.
If that refusal affects ordinary supported capture input or normal long-take use,
the repair remains incomplete: reslice a bounded alternative before enablement.
An experimental limit cannot close 20a by narrowing the recorder contract.

## Acceptance and review surface

Use frozen actual-writer continuous/omitted/pause media, then 20b's real accepted
records. Compare normal finish and fresh-process recovery on the same committed
prefix. Exercise journal missing/torn before/after append, media tail loss after
accepted append, truncation inside a run, undecodable interior data, multiple gaps,
nonzero rational origin and format refusal. Pin sample identities before/after each
gap, full versus late reads and exact sample length independently of output metadata.

Run the same source reader and capture preservation gates. Reuse the storage proof's
matched controls; preserve its historical red while upgrading the active oracle only
after the reader correction passes. No production packed writer rollout yet; 20d
owns canonical-only admission and publication safety. No physical-sync claim.

Delegated: extraction/naming of shared native helpers and bounded iteration strategy.
Representation, truthful uncertainty and no duplicate timing owner are fixed.
