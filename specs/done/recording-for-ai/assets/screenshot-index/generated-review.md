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

**All seven generated contracts pass.** The current run includes source-wide
[bounded stillness](stillness-runs.md), requested-time cache reuse and the
[selection-ceiling correction](before-event/review.md). Neither fixture encoding
nor expected counts changed. Full scale and real-capture acceptance remain open.

| Generated input | Selected images | Unique rendered PNGs | Evidence |
| --- | ---: | ---: | --- |
| Circle and wave on a static page | 5 | 5 | Both emphasis endpoints selected |
| Still page, pointer known outside | 2 | 2 | Only the two mandatory endpoints |
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

## Stillness comparison

The [before/after manifest](stillness-pixel-comparison.json) matches candidates by
requested source time. All seven encoded videos have unchanged hashes. The only
selection changes remove redundant still-page requests at five, ten and fifteen
seconds; all sixty remaining PNGs are byte-identical to their previous counterparts.
The native public fixture therefore demonstrates changed selection without changing
the recording or rendering. True changes confined to the documented two-level
channel allowance may collapse; sampled stillness is not full-resolution equality.

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

The merged run passed the unchanged lab, 212 core tests, workspace build/types,
and nine native public index/trail tests. The public tests include CLI/MCP byte
parity, retained-image restart and cache eviction. Host and bundle fingerprints are
in the measurements. Fresh review inspected all sixty images across thirteen
sheets and both crops: no blank, broken or clipped content; stillness and pointing
are readable. Dense mandatory scene pairs, periodic-motion aliasing and caption
jargon remain limitations. Click metadata is explicit, but images have no click
ring; that extra visual effect is not part of the current contract.

The harness checks independently authored kept spans, actual transition sides,
full coverage duration, publication counts and bounded continuation progress.
Generated data does not prove physical cursor capture or real-world scene thresholds.

For focused gesture inspection, use the exact-pixel
[circle crop](generated/static-pointing/focus-circle.png) and
[wave crop](generated/static-pointing/focus-wave.png), together with their full
[contact sheet](generated/static-pointing/contact-01.png). The wave crop preserves
the diagonal approach as well as the wave; it does not hide that visible context.
