# Styled text layout evidence

Native CoreText preserves literal UTF-16 text and the explicitly imported font.
Vertical alignment uses glyph ink bounds; decoration bounds include requested
stroke, shadow and rounded background while retaining any raster clipping.

The native `YapFrameTests --text-vertical` and `--text-decorations` checkpoints
cover real Arial glyphs, empty text, placement and clipping. The earlier
[public admission refusal](public-admission.md) remains historical evidence.
[Operation decoding](operation-decoding.md) records the correction that enabled
matching native/public execution without adding defaults to correction fields.

## Public checkpoint

The existing [caption runner](../../../../../packages/test-harness/editing/captions.mjs)
now exercises CLI/MCP `frame.get` with matching plain/styled text and geometry.
FFmpeg is needed for independent pixel decoding: `FFMPEG` selects the executable,
otherwise it resolves from PATH. `YAP_NATIVE` selects the matching native worker.
The runner owns case selection and output-directory usage.

[Retained public evidence](public-checkpoint/) binds requests, native worker identity,
receipts and delivered PNG hashes. Static-sheet assertions prove unchanged ink
bounds, top/center/bottom placement, full decoration containment and actual pixel
changes in each decorated cell; the plain cell is pixel-identical. The compact
shadow example is caller-authored, not a product preset. Its offset points above
the glyphs so the decoration fits inside the bottom-aligned caption raster.

The public Unicode case preserves composed/decomposed literals exactly, refuses
Arial emoji substitution and missing glyphs, then imports Apple Color Emoji and
Devanagari Sangam MN explicitly. It renders colored 😀 and joined `नमस्ते दुनिया`
without substituted fonts or shortened UTF-16 ranges. This proves those imported
faces and strings on the recorded macOS version, not universal glyph coverage.

Matched full sheets and every 2× crop include all four sides and surrounding
space. The first critique found a faint shadow and an inadequately framed crop;
the current capture includes all surrounding space. A second critique exposed
sharp stroke spikes: the AVW regression found589 nontransparent pixels outside
the reported decoration bounds, allowing one antialias pixel. Round joins reduce
that count to zero without changing the bounds. Frame/movie implementation recipes
change so old cached pixels cannot survive this behavior change. The compact
shadow reduces the distracting separated duplicate. [Final independent critique](public-checkpoint/visual-critique.md) finds readable
placement, balanced panel padding, intact color emoji and joined Devanagari glyphs.
Mild shadow halo and ordinary crop-scale antialiasing remain deliberate/finite-raster
limits, without clipped glyphs or sharp corner spill. [Corrective code review](public-checkpoint/code-review.md)
finds no actionable defect. Native test execution was unavailable to the read-only
reviewer; the implementing agent retained the actual red/green native run.

The no-op falsification removed all requested decorations in a scratch copy of
the public runner. Both delivered PNGs became identical and the new byte-change
gate failed for the expected reason; the unmodified public checkpoint is green.
No listening, human watching or sign-off is an acceptance requirement.

The reviewer also suspected unequal rounded-panel padding. Independent white-pixel
bounds are `[397,301,166,30]`, while the panel is derived from ink bounds
`[56.953125,60.1796875,166.125,29.640625]` with uniform12px padding, translated by
`[340,240]`. Pixel rounding leaves13px above and11px below; there is no separate
bottom-padding setting or native padding asymmetry.

Review triage: the earlier two decorated variants intentionally requested different
shadow parameters; their mismatch is not nondeterminism. The latest compact shadow
is the accepted fixture. The accent example deliberately uses left alignment and
starts at its box edge; exact composed/decomposed ranges and fallback refusal remain
covered. There is no universal font, decoration or safe-area preset claim. Preview
display was attempted, but the owned Preview process timed out on AppleEvents and
was closed; direct image inspection and file-based independent review completed.
