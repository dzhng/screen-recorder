# Explicit font text-layout reproduction

The [standalone reproduction](../../../../../packages/test-harness/editing/text-layout.mjs)
loads exact font bytes into Core Text without registration, lays out literal text,
and checks the fonts used by shaped glyph runs before publishing a transparent PNG.
It is not wired into the composition or public caption commands yet.

```sh
node packages/test-harness/editing/text-layout.mjs --out /tmp/text-layout-fresh --font /System/Library/Fonts/Supplemental/Arial.ttf
```

This fixture deliberately uses a Latin font without Chinese coverage. The supplied
font's bytes must match the frozen report for a matched reproduction. The repository
contains its hash and raster results, not a copy of the system font. A future
public renderer must support explicit dependency admission rather than assume this
font path exists on every host.

[Requests and receipts](report.json) retain exact text, font identity, box/style,
actual line strings, placement, visible ranges and output hashes. Punctuation,
newlines, long-word wrapping and alignment pass; the requested short-height and
nowrap boxes explicitly clip. Same-request output is byte-identical. Changed and
missing files, and Core Text's ambient glyph fallback, fail before PNG publication.
Disabling the fallback check in a scratch-only copy makes the refusal assertion
fail; its log is retained. No production code or readiness is changed.

[Ink bounds](metrics.json), [contact sheet](contact.png), original transparent PNGs
and enlarged dark-background composites are retained as the complete visual set.
The [limited-context review](review.md) found no unexpected layout defect, and
scopes alpha-edge inspection to the supplied dark background. A fresh reviewer
spawn was unavailable because the agent thread limit was reached; the reviewer
had heard only that this experiment existed and did not inspect its code or spec.
No claim of fully unprimed review is made.

Core Text may select a [substitute font](https://developer.apple.com/documentation/coretext/ctfontcreateforstring(_:_:_:))
for uncovered characters, so naming the requested font is insufficient evidence.
Its [visible string range](https://developer.apple.com/documentation/coretext/ctframegetvisiblestringrange(_:))
reports which characters fit vertically; nowrap width clipping additionally needs
the actual line width. These boundaries guide the production integration.

The next pass must integrate through the existing layer executor, retain font
identity through project history/packages, and exercise occurrence-specific
split/trim/retime captions through actual CLI/MCP preview and export. This
reproduction does not establish those contracts, cross-host raster identity,
arbitrary Unicode coverage or caption legibility over moving footage.

[Verification](verification.json) pins both reproduction sources. Independent code
review found no actionable defect within this fixture scope and independently
reran the harness after directing the Swift module cache to its scratch area.
