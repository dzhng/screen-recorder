# 19f — Public durable voice generation

Status: planned. Parent: [19](19-voice-assets.md). Dependencies: [19c](19c-common-model-preparation.md), [19d](19d-voice-settings.md), [19e](19e-retained-audio-excerpts.md).

## Contract and seam

voice.generate publishes a reusable generated audio asset through existing jobs;
it does not edit a project. Accept a registered model ID, retained admitted
reference asset/stream and explicit reference transcript, desired text, optional
preset and supported setting overrides. Resolve to one complete canonical request
before admission, including selected reference provenance, actual audio identity,
requested/effective settings and registered model/runtime/entry identities. Model
and preset identities are immutable registered content, available without a local
installation; changing defaults produces a new identity. Reference origin selection
is explicit and stable, never a live enumeration of an asset's growing origin set.
Omitting origin selection means no historical origin is selected; do not silently
choose one or add current origins to the deduplication key.

Target the retained reference asset on the existing heavy lane. Use exact frozen
input identity for queue deduplication and lost-response replay; changed text or
settings identify different work. Retry uses the frozen request, not current
preset defaults or donor project state. Complete output bytes are authoritative:
replaying successful generation never requires regenerating or a model being
available. Resolve the deterministic request and look up existing work/output
before requiring local model readiness. Only a lookup miss or an actual retry
requiring execution checks prepared files. Same reference audio with different
text remains distinct work.

Consolidate staged generated/imported/package asset publication under AssetStore.
Hash/probe/copy outside the transaction, then publish immutable metadata, typed
provenance, reference dependency and job result inside the existing attempt fence.
Do not fabricate portable-package metadata as a generation adapter or introduce
another store/queue. Preserve process closure, workspace cleanup and stale-attempt
fencing. Generated assets retain actual reference bytes through ResourceReferences.

Return existing job status plus asset/stream, actual duration/format and provenance
when ready. Unprepared inputs return an actionable readiness failure; no automatic
preparation, wording choice, denoise, room tone, timing fit or project mutation.
CLI/MCP share protocol schemas; teach only implemented operations in the product
skill. Ordinary edit.apply owns insertion/replacement and undo.

## Verification and review surface

Implement the parent's voice-assets public journey. First import the unchanged
frozen reference and require exact full WAV/PCM parity through public generation.
Exercise supported overrides/effective receipts, CLI/MCP equivalence, restart,
crash/cancel/worker failure, stale attempt, lost response, retry and unavailable
model/runtime. Confirm failed generation leaves projects unchanged and no partial
asset ready. Verify saved output playback/export after model removal, with donor
project deleted after reference acquisition; package it into a model-free library.

Then run parent19's explicit replacement/insertion and room-tone context checks
with actual rendered media, preserved picture and undo. Full sentences and clear
transcripts are the listening surface. Report pronunciation, speaker identity,
level and join timing separately; success of a job or exact preset parity does
not close parent18/19 quality, retiming, latency or physical acceptance.

Preserve existing import, job, package, processing and edit lifecycle gates.
Delegated: operation plumbing and internal names within established owners. No
preset-only public acceptance, new generation registry or hidden fit policy.
