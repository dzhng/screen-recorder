# 17 — Text and attached captions

Status: caption authoring, occurrence attachment and retained dependency closure verified
within the [acceptance evidence](../assets/17-caption-acceptance/README.md).
Dependencies: [17a](17a-text-layout.md), [17b](17b-font-admission.md),
[17c](17c-literal-text.md), [17d](17d-transcript-seeding.md),
[10](10-project-evidence.md), [16](16-keyframes.md).

## Contract and rationale

Explicit text overlays and transcript-seeded captions use ordinary video clips.
One anchor graph determines project, source-content and normalized-clip timing;
text has no media stream or source clock. This avoids a second caption timeline
whose edits could diverge from media attachments. The unshipped empty captions
container was removed when the ordinary text source became the public contract.

Literal text, exact imported font file/face, size, color, alignment, wrapping and
raster box are explicit. Ordinary geometry positions/scales that raster. File-backed
Core Text runs must use the requested face without ambient registration or silent
fallback. Selected-font missing glyphs are a separate refusal from fallback.
Font dependencies follow the immutable asset owner through history and packages.
The [literal checkpoint](17c-literal-text.md) records frozen reproduction parity.

Seeding resolves explicit groups of pinned word occurrences into one atomic batch
of ordinary placements. Repeated source speech is disambiguated by occurrence ID.
Immutable origin evidence remains separate from corrected display text; corrections
do not rewrite source words or synthesize audio. Origin clips may later disappear,
while retained source generations and historical origin evidence remain valid.
The [seeding checkpoint](17d-transcript-seeding.md) owns this provenance contract.

The required visual processing and anchor primitives from dependency 16 are
verified. Its still-open audio-transition/retime/denoise acceptance belongs to
separate audio owners; an aggregate dependency checkbox does not invalidate these
caption-specific capabilities.

## Verification boundary

Retained public journeys cover explicit styles, finite-box layout, exact face
selection/refusal, all three anchor domains through split/trim/retime/repeat,
source/display separation, replay, fresh-store package history and undo. The
final acceptance closes the two remaining finite gates: fresh critique of text
over the frozen video fixture and delivered off-grid range/full caption samples.
The existing compiler owns frame phase; a clipped first picture retains its
original project sample even when its caption has ended before the preview starts.

Fresh critique and implementer/root inspection establish scoped layout and
legibility, including requested clipping and sampled encoded edges. They do not
establish continuous playback, every glyph/language, ASR accuracy, speech
synchronization quality or retimed audio execution. Those omissions are explicit
in the evidence and do not replace their separate owners' acceptance gates.

The durable probe is `packages/test-harness/editing/captions.mjs`; its named cases
consume public CLI/MCP operations. Production owners are composition text/anchor
schemas, the core text-seed resolver and transactional ProjectStore, and the
native text raster in the shared picture executor. Preserve the shared
[contracts](../contracts.md) and [preservation gates](../verification.md#preservation-matrix).
