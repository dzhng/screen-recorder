# 20d2 — Public immutable asset metadata pages

Status: public/indexed prerequisite verified. Dependencies: [20c](20c-sparse-capture-materialization.md).
Prerequisite evidence: [probe file delivery](../assets/20d-probe-file/README.md)
and [physical-row admission](../assets/20d-probe-rows/README.md).

The actual admitted 100,000-run source previously made `asset.get` exceed the unchanged
8 MiB response frame. Keep AssetStore's complete internal metadata authoritative.
Public `asset.get` returns stream headers and segmentCount; `asset.segments` returns
exact ordinal pages from AssetStore-owned indexed physical rows. Use this uniform shape for every
asset, not a small/large conditional interpretation. Font faces and image metadata
retain their meanings. The indexed rows replace stored JSON arrays; internal complete reads reconstruct them. No duplicate metadata store, readiness registry or clock parser.

Pages preserve all fields, empty rows and original order. Bound replies, validate
asset/stream/cursor identity and bounds, and report continuation explicitly. Update
public help, skill and affected journeys together. Keep compiler and canonical
admission reads complete through existing internal owners.

Verify all 200,000 real rows reconstruct exactly through CLI/MCP, alongside small
media/font preservation and invalid cursor/identity cases. Measure complete
traversal work and RSS at small and large cardinality. The rejected JSON-per-page
experiment passed latency but reached about 1.03GiB RSS at 200k rows, so bounded
output did not establish bounded work. Indexed keyset pages must satisfy the
existing query gate without retaining a duplicate JSON array.

Package metadata is separately owned by [20d3](20d3-package-asset-metadata.md).
Neither prerequisite closes the remaining 10,000-source-selection or capture rollout gates.

[Retained evidence](../assets/20d2-asset-pages/README.md) contains the rejected JSON-query memory result, indexed small/large measurements, actual all-row public reconstruction and transaction/adoption controls.
