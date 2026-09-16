# 14b1 — Explicit media assets and shared audio planning

Status: shared consumer checkpoint implemented within [14b](14b-portable-inspection.md).
[Generated evidence](../assets/portable-inspection/README.md); actual source/scene
storage and full native relocation are not implemented by this pass.
The later [14b3 checkpoint](14b3-retained-inspection.md) supplies generated
reader/native relocation evidence. Public package/export gates remain separate.

## One question

Can the existing audio inspector plan the same edited excerpt from explicitly
resolved media assets while depending only on the evidence reads it consumes?

The current private AudioInspection planner combines playback/source mapping,
acquisition gaps and missing-role rules with library path construction. Extract one
reusable `planAudioExcerpt` function in the audio owner. It accepts the pinned
revision, requested playback range/track, source evidence metadata, the narrow
`hasAudio`/`audio` read capability, and an owner-provided role-to-asset resolver.
It returns the existing native spans/tracks and missing-role report. The resolver
supplies paths only for acquired selected roles; the planner never constructs a
library-relative path. Asset containment is the resolver owner's responsibility.

AudioInspection remains the real first consumer at admission and execution. Keep
its queue, cache, decode-response validation and publication unchanged. Move range
limits and missing-role decisions once, without a package-specific planner. Preserve
trimSpans as the mapping owner and SourceEvidenceStore as the acquisition query
owner. Failure/retry and lease behavior stay covered by existing public tests.

Replace concrete source/scene store requirements in frame/trail/selection readers
with structural read capabilities containing only their consumed methods. Do not
export a speculative all-purpose repository interface or change query semantics.
Writers keep their concrete store owners. No package handle, ZIP, shadow database,
transcript artifact or library import is introduced.

## Verification

Use real source-evidence ingestion and the production AudioInspection executor.
Pin edited spans, gaps, requested-but-unacquired versus unrequested roles, and
missing-role errors. Resolve generated source fixtures after moving their media
folder, prove the old path is gone and the plan reads the new asset bytes. This
proves asset resolution, not relocated catalog independence or native sample parity.
A metadata/identity mismatch must fail before a decoder sees a plan.

Keep the full existing audio/frame/trail/selection tests green. Mutation-test one
wrong asset resolution and one lost edit/acquisition interval. A machine-readable
fixture receipt is sufficient; no visual output changes. Run repository review and
independent review before committing. This is a shared consumer boundary, not a
claim that a complete package can already be opened.

## 14b2 storage proof before a generic reader

Implemented by [14b2](14b2-source-evidence-pages.md); its source-only scope and next
scene/index/native gates remain explicit.

SourceEvidenceStore indexes normalized `{sequence,event,sourceUs,content}` records;
sequence is delivery order, not global timestamp order. Its cursor continuation
validates an anchor sequence inside the requested range. Timed/unplaced geometry
also needs sequence and epoch ordering; audio queries use coalesced disjoint per-role
intervals and include the preceding interval when it overlaps the requested range.
A plain chronological scan cannot replace those semantics.

Use ordinary bounded JSON record pages with explicit first/last keys and referenced
page paths; preserve normalized record sequence and content. Maintain query-specific
orders matching those existing reads (source time/sequence, sequence lookup,
geometry epoch/sequence, and audio role/start time). Export those orders through the
current evidence owner. Share boundary/continuation validation rather than copying
it into a package adapter. No reconstructed RevisionStore or library tables.

Before introducing a reusable paging abstraction, prove source-only page round-trip
with out-of-order buffered cursor events, equal timestamps, an unknown continuation,
unplaced geometry around a pause, and a preceding audio interval spanning a query
start. Bound loaded page bytes/rows and metadata size; stale/missing/truncated pages
must fail. Page size and seek-table encoding remain delegated after that measured
proof. Then extend the same tested file access to scene chunks and retained index/
coverage records, and resume all original 14b relocation/native parity gates.
