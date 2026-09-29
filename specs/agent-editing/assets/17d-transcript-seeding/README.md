# Transcript-seeded text evidence

The public probe uses actual retained source word records and three distinct
occurrences. Its requests, receipts and assertions are in [public/report.json](public/report.json.gz).
It drives the public service through CLI/MCP, then relocates a processed package
to a fresh library with no speech models. The package itself is omitted because
it contains imported system font bytes. Current caption-only pixels and undo
pixels survive relocation; source records remain unchanged after display correction.

[Movie reads](movie-read/report.json.gz) import the exported movie and request three
caption samples plus a gap through the public Apple frame reader. These decoded
images are lossy output observations, not a pixel-equality promise. Raw PNGs are
untouched; [visual sheets](visual/manifest.json) transform embedded profiles into
explicit sRGB before compositing full contexts and enlarged crops.

The public refusal labelled `missing-generation` in the frozen receipt combines
a missing generation with a word selection invalidated by trimming its occurrence;
it actually refuses the origin support first. The focused core tests separately
prove missing-generation refusal. Do not attribute that public receipt to the
later generation lookup.

The worker is `/tmp/screenrec-caption-output-combined-native`, SHA-256
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
No native renderer code changes in this pass. Source transcription uses the
existing pinned speech request from slice12; this verifies dependency and occurrence
semantics, not linguistic accuracy or audio stretch quality.

Preservation:335 passing checks and one existing skip across composition/protocol
and affected core suites;27 service/CLI checks pass. All dependent builds and
core/service type checks pass. The independent code review found an optional-field
type mismatch; its explicit undefined allowance was corrected before those checks.
The exact-time reproduction is retained red/green: seeded text placement accepts
existing rational endpoints rather than rounding after retime/partial-word selection.

Fresh [public-skill review](fresh-skill/REPORT.md) passed repeated occurrence
seeding, correction, exact replay, unchanged source words and direct missing-generation
refusal on an intact occurrence. It independently authored exact fractional
project endpoints after retime and inspected two actual rendered PNGs. Discovery
friction remains: large generic/edit help and response shapes learned from receipts.

The independent visual review inspected all17 contexts and crops, plus raw
canonical/decoded samples. My own inspection agrees: readable unclipped captions,
consistent repeated placement, changed display literal and empty sampled gap.
Encoded edges show modest softness/ringing; stills do not establish continuous
playback or synchronization. The full raw critique is `fresh-visual.log.gz`.

Verbose receipts and logs are gzip-compressed with their original byte contents;
use `gzip -dc` to inspect them. No evidence is discarded during compression.

Fresh-consumer raw request/receipt/help/stderr files named by its unchanged report
are in `fresh-skill/raw-requests-receipts.tar.gz`, with individual gzip members.

Root independently inspected all four sheets (17 contexts and crops) and agreed:
legible text, consistent repetitions, correction/adoption/undo consistency and a
blank sampled gap, with modest softness at encoded glyph edges. This is scoped
to the sampled stills, not continuous playback.
