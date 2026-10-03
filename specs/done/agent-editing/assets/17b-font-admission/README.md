# Immutable font admission evidence

Scoped admission/discovery passes; caption authoring, glyph coverage and rendering
remain [17](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/17-text-captions.md). The [public journey](../../../../../packages/test-harness/editing/font-assets.mjs)
uses isolated CLI/MCP transports and the native probe; [its report](public.json)
retains requests/results, source hashes, all face metadata and the frozen worker hash.
System font bytes are used only in temporary fixtures and are not redistributed.

The journey admits one Arial face and all four Al Bayan collection faces, including
an extensionless collection. It checks exact hash identity, repeated imports,
distinct bytes with the same face names, source-deletion replay, missing/corrupt
refusal, paged CLI/MCP asset-list parity, refusal to place a font as media, and
restart persistence. Both single-font and collection metadata survive a service
restart. The list reports zero streams/media kinds and a separate font face count.
No system font registration or global name lookup is used.

Core tests verify portable asset staging/byte retention, empty composition
projection, and refusal of duplicate face names or mixed font/timed metadata.
The existing [media import journey](media-preservation.json) still passes its real
native CLI/MCP, unsupported codec, deduplication and restart checks. This establishes
that optional metadata can travel through the existing portable-asset boundary;
it does not claim caption font references already root a complete public package.

The first font lifecycle test failed on the previous schema, then passed after
font admission. The [initial public failure](initial-error-expectation.json) records
an overly specific test expectation: truncated font bytes reach the shared native
decode refusal (`NATIVE_DECODE_FAILED`), not the harness’s assumed
`UNSUPPORTED_MEDIA`. The corrected harness pins that existing decode contract;
no production error category was changed or corrupt input accepted.

Reproduce after building service/CLI and the native worker:

```sh
SCREENREC_NATIVE=/absolute/frozen/screenrec-native node packages/test-harness/editing/font-assets.mjs --font /System/Library/Fonts/Supplemental/Arial.ttf --collection /System/Library/Fonts/Supplemental/AlBayan.ttc --out /tmp/font-admission-evidence
```

Font metadata does not establish glyph coverage, font licensing/redistribution
rights, variation-axis support, text layout or visual quality. Those remain
explicit downstream contracts. Independent code review reports no actionable defects. It passed all 14 asset
checks; its unrelated broad run hit sandbox network refusals, timeouts and Swift
cache/toolchain limitations. The direct unsandboxed gates pass: native worker build,
all repository type checks, 25 asset/project/package checks, then 17 focused
asset/portable-asset/package checks after the final test additions. The final
native media preservation journey also passes with the same frozen worker as the
font journey. A first core type check ran before rebuilding updated composition
dependencies and failed on missing output-settings exports; the dependency build
and final repository-wide check resolve that stale-dist condition.

Shape review kept font format probing under native media admission and byte/metadata
ownership in AssetStore. Diff review found no remaining naming, validation or
second-owner issue. Documentation review links this prerequisite from slice17 and
keeps glyph/layout/font-reference package closure explicitly downstream. No
renderer or caption schema was added. [Fresh public skill consumption](skill-review.md) now passes13 value-based
identity, replay, listing and clean-restart checks without implementation-based
discovery. The review states its permitted infrastructure exposure and excludes
MCP parity, glyph coverage and caption readiness. Its [complete evidence](skill-evidence.zip)
is retained. [Root integration](root-integration.json) also passes the targeted
build and17 asset/portable/package tests.
