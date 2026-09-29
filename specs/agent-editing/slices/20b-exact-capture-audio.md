# 20b — Exact capture placement and accepted PCM addresses

Status: planned; production implementation waits for the exact-reader gate below.
Dependencies: [08](08-audio-mixing.md).

## Contract and owner

CaptureClock alone maps media into the take's source time. Preserve its first usable
video origin, pause-overlap rejection, delayed-delivery handling, removed-pause
semantics and sealed duration. Retain exact numeric input PTS and frame/rate duration
through that owner; integer microseconds remain projections for existing reports,
cursor/UI consumers and public boundaries, not anchors used to count PCM frames.
A rational origin is not silently rounded before subtraction. This does not change
which device clock ScreenCaptureKit timestamps belong to or establish physical sync.

CaptureWriter's existing serial callback queue owns accepted physical frame addresses.
After a successful append, journal the role/payload identity, cumulative first PCM
frame, exact frame count, output format identity, raw PTS and exact mapped source
anchor. Preserve the clock's origin/pause evidence and sequence so placement remains
authoritative without another mapping implementation. Failed/backpressured/omitted
appends advance no accepted-frame count. Acceptance is not disk commitment.

CaptureJournal owns the persistent format discriminant, new records and streaming
read boundary. Distinguish actual older files from packed staging unambiguously;
this is a disk-format contract, not internal API version negotiation. No precise
frame addresses may be inferred from older rounded audioSamples ranges. A journal
write failure prevents canonical publication and leaves truthful recoverable state.

One active run coalesces only exactly adjacent physical frames, raw PTS advancing
by the prior frame/rate duration, unchanged format and unchanged pause mapping.
No epsilon merging. Format changes end the supported epoch with a typed result;
do not mix frame counters across sample rates or silently convert the source clock.

## Start and rollout gates

The separate SourceAudio owner must first prove the frozen rational MOV returns
original sample 52800 at 1.2s, with full/late parity and ordinary 44.1/48k preservation.
The retained [storage proof](../assets/20a-sparse-storage/README.md) documents the
current red. Its banked mechanism is input evidence, not a dependency on completing
parent 20a; 20a's delivery failure is resolved only by the complete repair chain.

This slice may establish owner methods, records and offline seam tests. **Do not
switch production to packed timestamps/files until 20c and 20d are wired.** No
intermediate commit may expose packed bytes as canonical source-time audio.

## Acceptance and review surface

Extend the existing actual-CaptureWriter prerecorded callback probe. Cover nonzero
rational origins, supported raw scales, ordinary 44.1/48k continuous callbacks,
exact run continuity without run explosion, omission, pause-crossing rejection,
resume-delayed callbacks, pre-origin pause, seal and format change. Unsupported
precision/overflow refuses; no invented tolerance or broad all-device claim.

Before choosing the representation, exercise actual raw-scale candidates, including
nanosecond host timestamps combined with 48 kHz: their common scale can exceed
CoreMedia's Int32 limit. The 44.1/48k plus-microseconds storage proof is not general
raw-clock support. A representability refusal affecting ordinary supported capture
input **fails the repair gate**; it requires a bounded alternative/reslice, not a
policy narrowing away normal recorder behavior. Never use an epsilon to hide phase.

Stream/restart the journal with append rejection, write failure, torn/invalid tail
and both narration/system roles. Prove old source bytes remain unchanged. Preserve
capture clock/cursor/geometry/lifecycle tests and the separate source reader gate.
The runnable result is exact accepted-address/clock receipts beside actual PCM,
not a new service operation. No live capture or listening acceptance is implied.

Delegated: internal names and representation within existing module boundaries;
choose an exact arithmetic representation consistent with existing media types.
Do not duplicate CaptureClock, create a reader-specific offset, or widen public
composition coordinates. Record any required contract change before implementation.

Root architecture review and an [independent read-only plan review](../assets/20b-exact-capture-audio/plan-review.log.gz)
confirmed this owner sequence; production implementation remains gated above.
