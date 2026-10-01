# 21f2 — Fresh-service capture coordination and source admission

Status: selector-free coordination implemented and verified through scripted
controller/worker boundaries; root integration remains pending. The
[verification packet](../assets/21f2-capture-coordination/README.md) records the
precise source and public CLI/MCP evidence. This checkpoint builds on the
[durable admission contract](21f2a-capture-admission.md); it does not complete
[public selected-camera integration](21f-public-camera-selection.md).

## Contract

The surviving CaptureService uses the fresh service's one CaptureStore/catalog,
existing private control channel, startup reconciliation and close order. Capture
priority comes from durable takes and uses the existing job queue. Source admission
status comes from durable acquisition intents and jobs; notifications only prompt
work and cannot prove its completion.

The caller still constructs projects explicitly. Public camera selection remains
a separate atomic checkpoint; no installed switch, migration or physical capture
is part of this child.

## Public source discovery

Fresh capture replies and recording reads expose `sourceAdmissions`, a bounded
per-source list. Each entry carries `kind`, `sourceId`, `acquisitionId` and the
existing public job receipt. This selector-free checkpoint emits only an eligible
settled primary source, backed by CaptureStore authority. Before acquisition
admission, both acquisition and job identities are null: source settlement is
known, but queue admission has not succeeded. That means pending only when
`admissionError` is null. A conflicting explicit import request is a durable
admission refusal, reported through that existing error shape without hiding the
completed capture or borrowing the other import's acquisition/job. Once admitted,
the actual job owns
queued, running, failed, canceled and ready facts and explicit retry behavior.
`acquisition.get` retains the full immutable binding/support/clock metadata.

Reads never admit work. Startup and existing queue capacity notifications resume
eligible settled sources that have no acquisition intent. The later selected
camera checkpoint supplies its actual durable binding/result authority through
the same list; this checkpoint invents no camera record or media role. Capture
stop still creates no project or editorial state.

## Lifetime and managed bytes

Fresh capture allocates, recovers and admits source files under the same library
root used by aggregate storage and managed files. Installed recording paths keep
their current root until cutover. Recording deletion and source cleanup remain
unavailable in this service: their later port must join unfinished acquisition
readers before removing donor files. Ready acquisitions own their copied bytes
and remain readable after donor removal.

Private controller loss closes the same service lifetime. Shutdown owns even a
listener still being bound, drains capture/recovery and queue work, then releases
the catalog and startup lock. An already-ended controller cannot publish a new
service. With no private controller supplied, project operations remain usable
and capture control refuses without allocating a take.

## Evidence boundary

The [public journey](../../../packages/test-harness/editing/capture-coordination.mjs)
drives actual CLI/MCP adapters and the fresh service with scripted device and media
replies. It proves wiring, durable identity, readiness/retry and donor-free reads;
it does not prove media decoding, physical synchronization, UI, audio quality or
completed-stop timing. Focused source controls and exact runtime pins live in the
verification packet. The caller-authored media evidence remains owned by
[21e](21e-capture-project-adoption.md).
