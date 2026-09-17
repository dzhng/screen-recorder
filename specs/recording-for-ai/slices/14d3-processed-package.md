# 14d3 — Complete processed-package export

The product has exactly two export choices: video and processed package. Both use
one [RecordingExports owner](../../../apps/service/src/exports.ts), one intent table,
and the existing JobQueue. Publication, recovery, cancellation, abandonment,
storage and recording deletion retain the same ownership regardless of format.
A directory of diagnostic evidence is not a third export choice.

## Pass 1 — Shared request identity

The kind is explicit in the request, durable intent and replay key. Reusing an
export UUID for another kind conflicts. Until the package producer exists, a new
processed-package request fails explicitly before reserving an intent, prerequisite
job or destination. Video behavior remains available through the shared lifecycle.
The development catalog guard refuses the older schema without rewriting data.
This checkpoint is internal; public adapters and menu composition are separate.

Verification: actual owner requests prove unsupported packages leave no intent,
job or output; video replay retains its identity and kind; changed-kind replay
conflicts. Existing video cancellation, crashes, recovery and deletion remain gates.

## Pass 2 — Pin complete prerequisites before assembly

Pin revision/history at request. Select successful source and scene generations
once, persist them before admitting their consumers, and pass them explicitly to
the index owner. IndexProcessing currently selects latest source/scene evidence;
it needs the explicit input seam already established for preview. Extend existing
source/scene/index cleanup authorities with export retention predicates rather
than add an export janitor. Pin the selected index generation too.

Use the same deferred job and shared pending-intent allowance. Waiting requests
consume no runnable lane. Dependency events may admit bounded work; failed owners
require explicit retry. Missing regenerable output returns to deferred admission
before expensive assembly, retaining the selected evidence. Durable publication
commit releases pins because regeneration is no longer needed. Confirmed
abandonment releases pending capacity and any remaining pins.

Verification: request R1, edit to R2 while prerequisites wait, regenerate source
and scenes, run cleanup, then retry. The assembled selection must still name R1
and the generations selected once. Exercise cleanup during index work, missing
index images at promotion, all waiting slots, failed dependencies and restart.

## Pass 3 — Complete portable assembly

Use the existing portable source, scene and screenshot-index page writers. Include
original immutable video, capture journal, actually acquired audio tracks and all
history through the pinned ordinal. Inventory hashes and lengths come from copied
bytes; do not export database files or machine-local paths.

The manifest planner requires source, scenes, index and edited events. The current
events fixture is not a production serializer. Add a bounded events serializer and
validator using the existing timeline projection, retaining pause placeholders
and cut boundaries. Do not fill that requirement with fabricated empty events.

No narration is determined from actual acquisition evidence, never a request
flag. Acquired narration remains explicitly unsupported until the accepted source
and edited transcript payload owners exist. A readiness envelope alone cannot
certify narrated payloads; retain the manifest validator's gate.

Verification: use generated media with nonempty cursor/geometry changes, pauses
and cuts. Compare serialized pages, selected image bytes, projected events,
track hashes and pinned history against independent live-source expectations.
Missing pages, wrong generations and source mutation must fail before publication.

## Pass 4 — Bounded ZIP bytes and publication

Add a streaming ZIP producer alongside the existing native archive owner. Give it
verified regular inputs with fixed permitted relative member names; no shell ZIP,
unrestricted directory walk or whole-media buffer. Enforce the existing archive
limits on observed bytes and entries. The separate package-derived output budget
is not an archive-size limit.

Produce an exclusive private scratch ZIP, then lend its retained descriptor to
Publication.prepare and retain the existing no-clobber commit owner. The first
implementation may copy those bytes into publication staging: removing that copy
is not worth creating another destination writer. Scratch must be registered to
the same intent/attempt before writing and accounted as unfinished private data.
Define its retained directory identity and interrupted cleanup before implementation;
reuse existing owned-workspace primitives, not a second intent table or scheduler.

Validate metadata and payload meaning before publication. The independent archive
reader verifies final bytes in integration tests. Its own heavy work must not be
nested as another queued job while the assembler occupies the sole lane. Extend
the existing byte-based worker budget to the actual assembly passes; no new timers.

Verification: close/delete the original library, move the generated ZIP, open it
through PackageRegistry and the native reader, and compare screenshot pixels and
on-demand frame/audio output with independent expectations. Truncated members and
source substitution fail. Kill during scratch creation, assembly and publication;
restart/retry/abandonment/deletion must clean only owned private data and preserve
external ZIPs. Large-member tests verify bounded memory and cancellation drain.

## Public completion gate

Expose both choices through one lifecycle API only when their corresponding
producer is honest. Public package support remains blocked on the complete
no-narration round trip above; narrated completeness remains blocked on accepted
transcription. Menu and CLI/MCP adapters delegate to this shared owner and cannot
introduce independent export state. Public video can land independently using the
shared owner while the package gate remains explicit.

### Pass 1 verification receipt

The actual generated-media owner suite passed 41 cases after fresh protocol,
client and service builds; focused library/deadline checks passed 25. Service
types, touched-file lint/format and diff checks passed. The unsupported-package
tracer first failed because the old owner admitted the request; the explicit gate
made it pass with no intent/job/output. Independent Codex review found no actionable
regression and independently passed the 25 focused checks. This is shared-owner
video evidence, not a complete package export or public-adapter claim.
