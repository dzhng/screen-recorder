# Temporal picture review

Target: every compiled presentation interval must show its specified source letter
and counter, with source aspect ratio and corner landmarks preserved. Proven empty
edits and project gaps are black; unavailable acquisition must refuse instead.
This is temporal/geometry acceptance, not a photographic or text-codec quality gate.

Every captured frame is included in the full sheets and enlarged counter sheets.
[Mapping](mapping.json) records their scenario and cell count. A is the frozen
reproduction configured for matched Rec.709/platform encoding; B is the production
native output. [Metrics](metrics.json) cover all eight matched pairs: distance,
channel differences and edge differences are zero. The independent decoded-byte
[profile comparison](../profile-parity.json) agrees.

An unprimed reviewer inspected all 44 files, first verifying duplicate hashes,
then inspecting all 28 unique full/counter sheets. Its findings:

- A/B full and counter pairs 01–05, 07, 13, 14 are byte-identical.
- Black cells appear in 03 cells 5–14, 04 cells 0–7, B-06 cell 1 and B-08 cells 20–24.
- A uses horizontal black bars and B uses vertical bars; landmarks/counters remain
  consistently framed within each source, with no counter clipping.
- Counters are readable. Enlarged views show blocky edges and mild colored halos,
  especially on B/digits, but no ambiguous or missing characters, major smear,
  tearing or overlapping frames.
- It described the holds/reordering without treating their order as inherently wrong.

The implementer independently inspected all 14 full sheets. The black intervals,
held/reordered counter patterns and contain framing agree with the scenario oracles;
they are intended behavior, not dropped footage. Accept temporal membership and
geometry. Preserve the halo/codec-quality limitation under slice 06; do not generalize
this acceptance to recorded screen text, HDR or photographic quality. No desktop
window or playback was opened.
