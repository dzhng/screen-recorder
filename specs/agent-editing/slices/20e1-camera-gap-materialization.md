# 20e1 — Verify camera gap materialization

Status: scoped retained-file edit-list/membership feasibility verified;
[evidence](../assets/20e1-camera-gap-materialization/README.md). Durable mapping/replay
and positive public color-admitted source remain unverified. Owning contract: [20e](20e-selected-device-probe.md).
Dependency: [20d](20d-capture-publication.md)'s verified canonical publication primitives.

## Question and retained failure

The feature-owned camera writer preserves a positive first timestamp but its raw
MOV reports continuous support across missing camera callbacks. Explicit sample
duration did not repair decoded support. Timestamp logs alone cannot satisfy20e.
Preserve both failures and the separately disqualified stale-binary invocation.

## One bounded experiment

Use the retained three-picture raw MOV and its actual accepted observations, not
new capture or a format sweep. Build one candidate using explicit occupied and
empty AVCompositionTrackSegments followed by passthrough export, the platform
strategy already established by CaptureAudioMaterializer. Do not change that audio
owner. Use NewFile-style no-replacement publication in a later implementation;
this experiment writes only a new private candidate.

Derive target ranges from accepted picture timestamps and declared frame duration,
quantized at the actual raw writer timescale using its declared rounding boundary.
Require exact source-picture identification; never select guessed nearest frames.
Verify occupied segment support, complete decoded picture timestamps and BGRA
pixel identity against the retained raw selected frames. Retain the candidate and
complete diagnostics whether successful or unsuccessful. The original raw input
must keep its byte hash. No changed tolerance, re-encoding fallback or new format.

## Implementation only after mechanism evidence

If the experiment passes, separately review the durable mapping/replay seam before
implementation. Mapping must be streamed feature-owned probe evidence, survive
interruption, and feed the same camera closure/recovery owner; a RAM-only list or
second production camera journal/schema is not acceptable. Keep raw camera bytes
until a candidate's support and pictures are verified. Existing NativeCapture
termination, CaptureJournal and audio publication remain the lifecycle owners.
No camera role enters production recording metadata or slice21 API.

## Acceptance boundary

This slice's first checkpoint earns only the exact retained MOV feasibility result.
It does not pass parent20e, interrupted mapping replay, physical capture, permission
behavior or parent20/21. Build only isolated scratch tools; do not enumerate devices,
request permission, record, play media, install, download or rebuild frozen workers.
Review source/evidence independently and retain immutable identities before commit.
