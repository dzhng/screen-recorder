# Retained screenshot index ownership

ScreenshotIndexStore remains the single owner of retained PNG files, image leases,
bounded entry/coverage paging and reclamation. Its domain validates recording or
selected-source meaning; no asset is represented by a fabricated recording.
Owner namespaces keep identical IDs and attempt names independent.

Recording identities, candidate receipts, coverage and portable package formats
are preserved. Their existing directories remain inside the recording. Source
indexes use separate retained evidence directories and carry actual asset/stream,
scene generation and physical sample clocks. Index ranges without a representative have no image ordinal.
Their basis distinguishes
proven source-support exclusion from a pinned unavailable sample observation.
The latter keeps its exact requested point/reason and labels the surrounding index
coverage unproven; it never claims that whole interval contains missing pixels.
Catalog 10 keys the existing tables by owner and supports these uncovered ranges;
older catalogs are refused without migration.

## Verification

Core preservation: 547 passed, one skipped. The initial broad run exposed stale
Catalog 9 compiled code in an existing subprocess test; rebuilding dependencies
resolved it without relaxing its timeout. Source-owned storage tests prove reopen,
held-image reads after removal, unchanged original bytes, explicit unavailable
coverage, and reclamation isolation against a real recording with the same ID and
attempt. A namespace mutation fails that isolation test.

Actual native package preservation passes three existing scenarios: complete
no-narration package reopening, pinned source-scene/index generations through
cleanup, and cancellation retaining the exact selected index bytes for retry.
No app was launched and no recording or playback occurred. JavaScript harness
constructors and direct SQL checks were swept alongside TypeScript callers.

This is the storage prerequisite. Source candidate selection, frame-job dependency
materialization and public source index routes are not yet implemented. Project
index mapping must additionally respect compiler picture phase and remains a
separate pass. Recording-only RetainedIndexRead remains its genuine portable view
until the source read adapter is generalized with the producer.

The first independent review found that declared support was being treated as
proof of decodable pixels. The corrected observation basis accepts a retained
`empty_edit` point within declared support without inventing interval-wide proof.
A direct actual-native experiment supplies deliberately coarse full-interval
support for generated two-track media with an empty edit. It samples, renders,
retains and reads both source indexes; their unavailable point is preserved with
unproven surrounding index coverage. The [receipt](native-gap.json) records the
coarsened probe boundary and native hash. This is a storage experiment, not a
claim that production probing or automatic selection produced that coverage.

A completed source index may contain coverage and zero images. Its readiness means
the index has finished describing evidence, not that an image can be opened.
Recording indexes keep their existing nonempty-image completion rule. The second
independent review exposed that distinction; the empty-source reopen/read test now
pins it alongside the recording package gates.

Final independent review reported no actionable defects and reran 27 source,
retained-index and portable-index tests. Shape review keeps one storage/lease owner
with domain-specific receipt validation; the source domain adds no scheduler or
cache. The caller sweep includes JavaScript harnesses and direct SQL ownership
queries. The source selector/producer remains the next separate checkpoint.
