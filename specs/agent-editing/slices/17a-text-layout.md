# 17a — Explicit font and text layout reproduction

Status: scoped native font/layout reproduction passes; limited-context visual review found no unexpected defect. Public integration remains17. Dependencies: [00](00-corpus.md).

## Contract

Before wiring captions into the composition, prove that native layout can render
literal text from an explicitly selected font file, report wrapping/clipping,
and reject silent fallback. This is an independent mechanism prerequisite for
[17](17-text-captions.md), not a public caption feature or a replacement for its
occurrence-specific timing and live preview/export gates.

## Seam and evidence

A standalone Core Text reproduction takes literal text, an exact font-file hash,
font size, foreground color, box dimensions, alignment and wrapping. It emits a
transparent PNG and a receipt with actual text ranges, lines and used fonts. The
font bytes are loaded directly, without installing or registering a system font.
Reject changed/missing font files and substituted glyph fonts; record missing
coverage instead of silently rendering with an ambient fallback. Core Text's
actual shaped runs, not a Unicode character whitelist, determine font use.

Start with punctuation and an explicit newline. Expand to long-word wrapping,
left/center/right alignment, clipped boxes and an unsupported-script refusal.
Retain input/output identities, raster dimensions and measured ink bounds. Verify
that rerendering the same request is byte-identical and that changing alignment
changes placement. Freeze the recipe before porting into the existing layer
executor; do not add a separate caption render service or glyph-cache owner.

Fonts remain dependencies under the parent contract: retained redistributable
font assets or an explicit required-system-font declaration. Local system-font
files used by this reproduction are identified, not copied into the repository.
The eventual public font admission/discovery and package closure are still17.

## Review

[Retained evidence](../assets/17a-text-layout/README.md) includes exact requests,
line/PNG receipts, full visual set, fallback mutation and review boundaries.

Judge only text layout/legibility at native and enlarged sizes. Inspect the full
capture set, including deliberately clipped output, and report clipping as an
explicit requested behavior. Missing-glyph refusal is a numerical/runtime gate,
not a visual pass. Apply compare-screenshots and screenshot-critique before
accepting the reproduction. Public rendering, timing, fonts on another host,
Unicode coverage beyond the tested fonts, and movie encoding remain unverified.
