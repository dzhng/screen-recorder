# Generated screenshot-index quality gate

The reusable `bun run lab:index` harness drives the bundled service's real
`index.get`, `index.coverage`, `index.frame` and delivery operations against
synthetic media and cursor journals. It neither captures a display nor enables
microphone or system audio. Its [fixture truth](generated/truth.json) is authored
independently of selector output. The [contact-sheet browser](generated/index.html),
[measurements](generated/summary.json) and [complete PNG manifest](generated/png-manifest.json)
retain every selected image, including mandatory duplicates. By default the lab
prints a fresh persistent temporary evidence directory; set
`SCREENREC_INDEX_EVIDENCE` to an empty absolute directory to retain a named run.
It rejects nonempty output directories so reruns cannot silently mix old images
with a new ledger.

## Outcome

**Stillness collapse remains red.** The current run preserves actual before/after
scene images after the [selection-ceiling correction](before-event/review.md).
Neither fixture encoding nor the expected stillness count changed. All coverage,
gesture, click and retained-cut checks pass; full parent acceptance remains open.

| Generated input | Selected images | Unique rendered PNGs | Evidence |
| --- | ---: | ---: | --- |
| Circle and wave on a static page | 5 | 5 | Both emphasis endpoints selected |
| Still page, pointer known outside | 5 | 3 | Expected two mandatory endpoints; failed |
| Navigation between pages | 7 | 7 | Both actual sides match independent transition times |
| Three rapid clicks | 6 | 6 | All button-down observations retained |
| Edited join followed by pointing | 5 | 5 | Removed source interval absent; eight seconds covered |
| Rapid full-page changes | 32 | 32 | All thirty reasons and actual sides retained |
| Continuous local motion | 3 | 3 | Three coverage/endpoints; no detected scene boundary |

The moving-element fixture keeps the page stable and names the motion region in
truth. Rapid full-page alternation is a separate stress case, so its density is not
misrepresented as continuous animation. Requested source, actual source and edited
times remain distinct in the captions. The six rapid-scene sheets retain the full
32-image result without thinning.

## Stillness diagnosis

Repeated measured pairs have zero changed-pixel and changed-cell fractions, but
mean absolute channel difference `5.106209150326798e-7`. The exact-zero static
collapse policy therefore conservatively refuses equality. Selected PNGs at five,
ten and fifteen seconds have the same SHA-256, while the first and last differ.
See the [unchanged red ledger](generated/stillness/ledger.json). No scene threshold,
selection tolerance or encoder setting was altered to produce a green report.

## Actual boundary-side diagnosis

Independent truth supplies each encoded page transition. Every selected before
image must decode before that transition, within the preceding page's interval;
every after image must decode within the following interval. Both navigation
boundaries and all fifteen rapid-change boundaries originally failed this check:
requesting boundary minus one microsecond selected the nearest future image at the
boundary. Reason tags alone did not prove preservation of both states. The current
run passes all seventeen before-side checks using an exclusive native selection
ceiling; the accompanying pixel comparison proves that the delivered images changed.

Fresh review inspected all thirteen sheets and both focus crops. The circle/wave
are readable. The periodic moving-element fixture returns near the same phase at
five-second coverage instants, so its three selections demonstrate a temporal
sampling limitation, not evidence that the region never moved. Clicks are represented
by recorded reasons and metadata; this fixture does not promise a click ring. The
shared dark-page text contrast remains unchanged. The HTML caption legend explains
source request, actual decoded source, edited playback and coverage-window counts.

## Verification boundary

The current run includes requested-time observation reuse and the before-event
selection ceiling. Its bundle hash, FFmpeg/Node versions, host and input dimensions
are in the measurements. All seven scenarios completed; the lab exited nonzero only
for stillness collapse. Source video/journal hashes stayed unchanged and all owned
processes were reaped. The artifacts retain 63 delivered PNGs, thirteen contact
sheets and two exact diagnostic crops. Listing uses at most three entries and
coverage at most two rows per page.

The extracted page/font owner preserves both original raster variants byte for
byte. All eight existing native public-trail tests pass after the shared page and
journal extraction. Formatting and lint pass. Independent code review found that
truncated coverage and stalled continuations could escape the first harness; those
were fixed with full edited-duration checks, strict cursor progress and finite page
budgets. Existing recorded pages were also reconciled against published candidate
and coverage counts. A further review found the edited-join check could accept frames
inside removed source time; it now checks both requested/actual frame mappings and
coverage ranges against independently authored kept spans. A mutated receipt at
removed second four fails that check; the delivered edited-join receipts pass.

For focused gesture inspection, use the exact-pixel
[circle crop](generated/static-pointing/focus-circle.png) and
[wave crop](generated/static-pointing/focus-wave.png), together with their full
[contact sheet](generated/static-pointing/contact-01.png). The wave crop preserves
the diagonal approach as well as the wave; it does not hide that visible context.
