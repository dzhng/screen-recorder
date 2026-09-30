# 19f — Public durable voice generation

Status: complete for durable public voice jobs; public, lifecycle, stable-origin and fresh skill gates verified. [Evidence](../assets/19f-public-voice-jobs/README.md). The [parent acceptance ledger](../assets/19-acceptance/README.md) supplies later contextual/ambience verdicts; the execution packet retains its historical listening limits. Parent: [19](19-voice-assets.md). Dependencies: [19c](19c-common-model-preparation.md), [19d](19d-voice-settings.md), [19e](19e-retained-audio-excerpts.md).

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

## Origin selection

The optional reference origin is the full typed object already returned by asset
inspection or extraction. Admission matches it against the reference asset's stored
origins, then freezes that object in the canonical job request. Omission freezes
`null`; adding unrelated origins later does not change work identity. Generated
provenance may retain a derived canonical origin hash, while the job keeps the
selected snapshot. There is no second origin-selector registry or parallel list.


## Verification order

Dependency-independent owner checks use a controlled renderer with the actual
catalog, queue and asset publication. They establish saved lookup before readiness,
stable origin omission/selection, frozen retry, attempt fencing and reference-byte
retention. They do not establish synthesis quality or native parity.

After 19d runtime adoption, the public journey uses the real service/worker and
unchanged frozen reference. Its complete WAV gate precedes overridden settings and
lifecycle cases. Model-unavailable replay, portable adoption and ordinary replacement
rendering then prove that saved bytes do not depend on execution readiness. Listening
and contextual quality remain the parent's separately judged surface.

Generated duration metadata preserves the pinned worker's rounded microsecond policy;
exact frame count and rate remain authoritative. This differs from excerpt duration's
floored metadata and does not assume generated frames always form whole microseconds.
No duration check changes PCM, retimes audio or invents output support.


## Execution readiness and historical receipts

Both service entry points construct their shared queue with deferred execution,
install dependency admission separately, and explicitly start execution after their
owner recovery and cleanup have settled. The recording service still reports startup
before background reconciliation completes. Fully assembled standalone queues retain
their existing eager behavior. Persisted queued jobs remain queued across assembly;
only an attempt that was running at a crash becomes interrupted. Retryable catalog
contention after the recording service reports startup is logged as background
admission failure; existing scheduling events can resume durable queued work. Fatal
activation errors remain visible.

Generated origins use the profile-independent structural receipt schema. Current
profile limits belong to admission/execution, so changing a future profile does not
invalidate historical portable assets. The internal output path is deliberately
removed before strict provenance validation. A selected origin is matched semantically
then frozen in schema field order with tokenizer identity record keys sorted by
code-unit order. Equivalent stored rows and caller key order cannot change identity;
arrays and exact field values remain unchanged.

The public context fixture authors complementary original/voice fades on separate
tracks over 5ms overlaps and retains an explicit original-room-tone layer. Its report
separates those authored ranges from the protected join windows that also contain
resampling boundary influence. PCM is exact outside replacement plus protected
windows; the narrower outside-replacement assertion remains a retained red. This is
mechanical preservation evidence, not a listening verdict or a fitted DSP tolerance.
