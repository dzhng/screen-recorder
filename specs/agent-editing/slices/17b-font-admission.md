# 17b — Immutable font admission

Status: scoped public admission/discovery, portable asset boundary and code review pass; fresh product-skill consumption remains pending in the combined font/output trial. Dependencies:
[02](02-assets.md), [17a](17a-text-layout.md). This is a prerequisite of
[17](17-text-captions.md), not caption authoring or rendering.

## Contract

Import font files through the existing immutable asset/job owner. A font has no
playable stream, duration or fabricated recording identity. Optional `fontFaces`
metadata contains the explicitly selectable faces in the exact admitted bytes.
The asset hash plus case-sensitive PostScript name identifies a face. Names are
unique within a file; two different asset hashes may contain the same name.
Reject missing or ambiguous identities rather than selecting the first face or
resolving an installed font by name. `originUs: 0` is only the existing probe
envelope convention, as for still images; it does not give fonts a clock.

Native probing uses file-backed Core Text descriptors without registering fonts.
Collections enumerate all faces, with descriptive family/style names. A bounded
collection admits at most 256 faces, matching the existing probe cardinality
boundary. No fallback, system-font installation, glyph cache, second blob store,
new render service or font-license inference is introduced. Admission establishes
file/face identity; glyph coverage and actual shaped-run fallback remain rendering
gates under17a/17. Variation-axis authoring is not implied by face discovery.

The asset list reports font face count separately from empty media kinds/streams.
Composition projection remains empty for fonts. Portable asset metadata retains
font faces and the existing byte-hash validation; future caption references must
root font dependencies in the existing graph before claiming project font closure.

## Verification

Prove public CLI/MCP import/get/list, exact deduplication, same names in distinct
byte identities, restart replay after external deletion, missing/corrupt refusal,
and supported collection enumeration. Ensure font assets cannot be placed as
video/audio clips. Verify the portable asset staging boundary preserves faces and
rejects ambiguous or invalid metadata, without adding fake composition references.
Preserve existing media admission tests. Retain native/compiler identity and
requests/results under the slice evidence directory; do not redistribute system
font files in the repository.

[Retained evidence](../assets/17b-font-admission/README.md) owns public requests,
results, worker identity and preservation checks.

## API sources

Apple documents [file descriptor enumeration](https://developer.apple.com/documentation/coretext/ctfontmanagercreatefontdescriptorsfromurl(_:))
for each font in a file and [data descriptor enumeration](https://developer.apple.com/documentation/coretext/ctfontmanagercreatefontdescriptorsfromdata(_:))
for TTC/OTC collections without making them available to global name matching.
[PostScript names](https://developer.apple.com/documentation/coretext/kctfontnameattribute)
are explicit descriptor attributes; absent names are refused before font creation.
