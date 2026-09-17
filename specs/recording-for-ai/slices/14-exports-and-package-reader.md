# 14 — Two exports and relocated AI inspection

Status: metadata, relocated inspection, bounded extraction, retained descriptors,
transient queue contexts, reusable outputs and isolated deliveries pass their internal
gates. Durable ready-preview video intent also passes its internal recovery/deletion
checks. Registry/storage recovery and deferred export admission are next. This plan
does not close 08, 11c or 13.

Read [architecture](../architecture.md), [contracts](../contracts.md#portable-ai-package)
and [verification](../verification.md). No public contract changes are proposed:
there are still exactly two export choices, human video and a complete AI ZIP.
Directory fixtures below are internal checkpoints, never a third export product.

## Grounded ownership and dependency map

- [timeline](../../../packages/core/src/timeline.ts) owns revisions, mappings,
  word/event projection and render spans. Package code never repeats that algebra.
- [materializeFrame](../../../packages/core/src/frame-materialization.ts) already
  receives revision, source and output explicitly. Its concrete evidence dependency,
  [trail reads](../../../packages/core/src/trails.ts) and library-relative paths are
  the portability work. FrameInspection and IndexProcessing also admit jobs; they
  must not be instantiated against a reconstructed library for package reads.
- Source/scene/index stores persist through the catalog; export ordinary evidence
  records and retained images, not SQLite or opaque job-result JSON. In particular,
  selected images do not replace the raw observations needed for new trail requests.
- Production transcript storage/inspection is absent. Slice 08 remains its owner;
  a generated manifest or fabricated word fixture cannot establish speech readiness.
- [13a](13a-native-render-timing.md) proves only its stated timing sub-scope. Video
  export and package playable preview require the accepted parent 13 renderer.

## Passes and acceptance order

| Pass | One question / seam | Dependencies and independently reviewable result |
| --- | --- | --- |
| [14a — Pinned manifest and readiness](14a-package-manifest.md) | Can portable identities, inventory and prerequisite states be represented without lying about completeness? | Existing revision/evidence contracts. Generated JSON report validates manifest candidates and pinned history; no archive or public export. |
| [14b — Relocated read-only media](14b-portable-inspection.md) | Can the existing inspector answer a new request using only relocated files? | 14a and existing source/scene/frame/index owners. Internal directory fixture compares metadata, retained index, arbitrary frames/trails and audio; no original library or analysis cache. |
| 14c — Bounded ZIP open and handle lifetime | Can validated extraction become an isolated read-only context? | 14b. Hostile archive fixture produces either a fully verified handle or an explicit error with no external writes. |
| [14d — Pinned export intent and atomic publication](14d-export-publication.md) | Can prerequisites wait without occupying their own execution slot, then publish exactly once? | 14a; publication containment proof and existing job/deletion lifetimes. Generated no-narration package round trip through 14c; not acceptance of narrated export. |
| 14e — Complete AI package integration | Do accepted narration and all promised read operations survive relocation through both adapters? | 14b–d, accepted 08 transcript contract and required index evidence. Complete narrated/no-narration packages, CLI/MCP open/close and package menu action. |
| 14f — Human video and package playable preview | Does the accepted renderer produce the pinned edit independently of speech? | Accepted 13 and 14d publication owner; 14c additionally for package preview. Video menu action and relocated preview, with audio audition and join/pointer parity. |

14c–f are bounded next contracts, not permission to guess an unfinished dependency.
Before implementing one, materialize its detailed seam using its actual predecessor
artifacts. A–B expose the missing abstractions first; do not build ZIP/menu plumbing
around a second inspection engine. Video and complete narrated packages can proceed
independently once their respective dependencies pass.

## 14c — Archive boundary and package lifetime

[Archive candidate research](../assets/portable-inspection/archive-candidate.md)
records malformed-tail and resource-fork probes.
[14c1 — Bounded extraction](14c1-bounded-archive-extraction.md) selects system
libarchive and proves an internal descriptor-owned extraction transaction.
Its bounded receipt validates container bytes and 14a metadata.
[14c2](14c2-retained-package-inspection.md) proves retained descriptor/media access
and parent-death lifetime. [14c3a](14c3a-transient-context-jobs.md) adds isolated
capabilities to the shared queue. [14c3b1](14c3b1-package-output-release.md) now proves
reusable outputs and isolated delivery identities. [14c3b2](14c3b2-package-workspace-primitives.md) pins archive inputs and owns retryable
workspace cleanup. Registry/storage reservation and startup reclamation come next,
then public opening and selectors.

Core owns package parsing/read access; the existing service owns explicit handles.
Each handle scopes immutable content plus its disposable derivatives, active native
workers and delivery leases. The embedded recording ID is provenance, not library
ownership: closing a package or deleting the same-ID library recording must not
revoke the other's resources. Extend existing lifetime owners with explicit context
identity when integrating; do not create fake recording rows or parse path prefixes.

Extract into private staging beneath the package cache. Enforce bounded actual
expanded bytes, entry counts, path lengths and per-entry sizes while streaming,
not only ZIP header claims. Reject absolute/traversal/backslash paths, links and
special entries, duplicate/normalized/case-colliding names, missing/unlisted members,
unsupported versions and inventory/hash mismatches. The manifest does not hash
itself. Pin directory ownership through extraction, verification and cleanup;
a prior path check followed by a later pathname write is insufficient.

Expose no handle before full validation. Close cancels/drains readers and workers
before removing extracted/cache files; retained deliveries become unusable. Exercise
two opens of the same content, two packages with the same embedded recording ID,
library deletion, close racing a decode, corruption and cancellation. Bound cache
storage without evicting an active package. Package mutation requests fail explicitly.
Archive implementation and numeric resource-policy defaults remain delegated, but
must be explicit and tested at their limits before adding public open/close.

## 14d — Readiness, snapshot retention and publication

[The publication plan](14d-export-publication.md) has a verified internal
external commit/recovery owner. [14d2a](14d2a-video-intent.md) now integrates durable
ready-preview intent and actual recording deletion. Deferred admission, pinned source
evidence retention, queue-admitted restart recovery, accounting and public wiring
remain; the [scoped evidence](../assets/export-publication/video-intent.md) records
the boundary.

Pin revision and history bound before waiting. Use existing job authority to expose
required dependency IDs while waiting outside every worker slot; do not add a
separate queue. At execution, pin the exact ready generations and hold their owned
read lifetimes through copy/hash. Concurrent edits, retries, cleanup and deletion
cannot replace inputs. Deletion cancels the recording's export and waits for its
real workers/readers; already published external exports remain untouched.

A missing/pending required artifact schedules or waits on its owner. Failure is
an actionable export failure; retry preserves the chosen revision/history bound.
Narration present plus failed/absent transcript is never `no_narration`. Legitimate
absence needs acquisition evidence. Ready empty recognized speech is distinct from
absent narration. Video never waits for transcription.

Write staging beside the chosen destination so publication stays on one filesystem;
never replace an existing destination silently. Verify all copied sizes/hashes and
required artifacts before atomic publication. Publication receipt, cancel, crash and
restart need one defined commit point: reconcile an already committed destination
without deleting someone else's file or claiming an incomplete output succeeded.
Prove this with faults before publish, after publish/before receipt, source deletion,
external directory replacement and full disk. No cross-device copy-as-atomic fallback.
Wire native export actions only after real completion/failure semantics exist.
Package inspection must use the existing queue-issued transient context capability
for native work; a synthetic catalog recording is not an acceptable bridge.

## Final gate and scope

Run planned `lab:exports`: export while edits advance; move ZIP and video outside
the library; make the original root unavailable; use an empty derived cache. Inspect
transcript, index/coverage, history, timeline, raw cursor and audio through CLI/MCP.
Request a previously unselected annotated frame near cuts, scene changes, pauses and
geometry changes, using relocated source media to reproduce request-local scene
comparisons under the recorded policy/options. Check source/playback and actual
sample times, not only pictures. Include interrupted recovered media, no narration,
pending/failed speech, unsafe archives and partial export termination.

For new visual outputs, compare identical parameters with original inspection using
compare-screenshots, then independent screenshot-critique last; audition movie cuts.
Follow [visual gates](../verification.md#visual-gates), including non-blocking human
review. Keep timeline/frame/trail/audio/index, queue/deletion and adapter parity tests
green. No model/runtime bundling, migration framework, library import/merge, Linux
reader guarantee or hidden ZIP edits. Root handoff/status updates remain with the
integrating agent; each pass supplies bounded receipts and unresolved gates.
