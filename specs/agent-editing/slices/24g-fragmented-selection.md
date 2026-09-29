# 24g — Bound repeated selection of fragmented source support

Status: model checkpoint verified; [evidence](../assets/24g-fragmented-selection/README.md). Combined public setup/package follow-up remains open. Dependencies: [24c](24c-edit-batch-work.md), [20d2](20d2-asset-metadata-pages.md).

The combined 10,000-occurrence/100,000-run package journey times out during its
first 500-place edit, before export. The edit commits and exact replay returns the
same revision. Preserve that observation; separate package/history successes do
not prove this combined workflow.

The composition owner currently re-derives all source support for each occurrence
and recursively freezes shared stream metadata repeatedly. An isolated 500-clip,
100,000-fragment profile takes 8.30 seconds and peaks at 609 MiB despite selecting
only one available fragment per clip. The profile attributes substantial work to
support conversion, allocation and repeated graph freezing.

Resolve immutable support once per stream/acquisition pair within one validation,
select sorted support at the requested half-open bounds, and visit shared objects
once when freezing the resolved graph. Keep exact rational boundaries, acquisition
intersection, source holds, parent support and all invalid-input checks. No global
cache, altered clock, widened edit deadline or skipped validation.

Prove exact agreement with the existing implementation for fractional selections,
holes, holds and acquisition/parent intersections, including boundary-touching
exclusions. Retain the measured red and inspect unchanged complete results. Then
rerun the actual public combined setup and its package/history/adoption gate with
the package owner. A faster isolated model is not full public acceptance.
