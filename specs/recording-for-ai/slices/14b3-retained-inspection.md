# 14b3 — Retained evidence and native relocation

Status: internal directory reader/native parity implemented within
[14b](14b-portable-inspection.md). The generated checkpoint does not expose a ZIP,
public package handle, accepted transcript or export operation.

## One owner per read contract

SceneEvidenceReader owns scene pagination for the catalog and file reader.
ScreenshotIndexReader owns selected-image and coverage pagination, including
candidate-filtered continuation validation. Existing writable stores remain the
first consumers. Scene append and portable payload reads share canonical chunk
validation; retained entries share the existing identity/edit admission checks.
Retained PNG validation and checked read-handle lifetime also have one owner.

The source-page transport from [14b2](14b2-source-evidence-pages.md) now has real
scene/index consumers, so its bounded JSON page, hash, key ordering and binary seek
mechanism lives in [ordered-pages](../../../packages/core/src/ordered-pages.ts).
It is storage transport, not a second evidence repository or timeline engine.
Each evidence owner defines its records, orders, metadata and policy compatibility.

Scene chunks retain coverage, comparisons and derived boundaries. Index pages
retain pinned revision, generation and policies, entries, and both global and
candidate-ordered coverage. Image export reads through the existing retained-image
owner; serialized entries replace only the known `frame.file` field with an
explicit relative image reference and byte/hash receipt. File reads resolve that
reference beneath their owned directory and use the shared PNG/read-handle owner.
Original library paths and cache IDs are not needed to read those images.

Unknown policies, wrong identities/revisions/continuations, missing or changed
members, count mismatches and invalid payload semantics fail explicitly. No page
read silently rebuilds scene/index evidence or substitutes another revision.

## Generated full-context proof

The optional [native lab](../../../apps/macos/tests/package-relocation.mjs) requires
an explicit isolated app bundle. It uses production mediaWorker, source/scene
processing and index publication; it does not launch capture devices. Its fixture
context carries explicit source assets, normalized evidence, scene/index pages and
history selected through the current revision owner. It is an internal fixture
header, not a new complete-package manifest or public reader route.

The lab pins an older edited revision while retaining all history known at export.
It copies the generated assets, closes/removes the original catalog and media,
moves the directory, and starts a fresh reader process. That process creates no
RevisionStore, queue or analysis cache. It calls the same frame/trail and audio
planning owners using only file readers and explicit moved assets.

[Evidence](../assets/portable-inspection/native-relocation.md) compares clean and
annotated arbitrary frames, retained images, scenes/coverage and native audio.
The arbitrary request is absent from the retained index. Checks include cut and
historical mapping, scene and pause cutoffs, geometry epochs, sparse requested/
actual timestamps, audible acquisition gaps, decoded pixels, unchanged input
hashes and closed owned worker processes. Existing missing-role planner tests
remain the missing-role evidence; this two-track native fixture acquires both roles.

## Remaining boundaries

The root and exported generation must remain stable while producing/reading these
internal directories. Reader payload validation does not authenticate a maliciously
rewritten manifest, nor establish descriptor-safe ancestor/root containment. Full
ZIP extraction, package-handle cache/lease isolation and cleanup lifetime stay in
14c; pinned export admission/deletion coordination stays in 14d. The reusable read
owners are ready for those callers without library rows or another scheduler.
Accepted speech/export prerequisites stay in 08/14e. No narrated complete package
is enabled by this fixture. Source color fidelity and overlay presentation quality
are separate from pixel equality before/after relocation.
