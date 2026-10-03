# Retimed curve delivery

Stretching changes which source instant belongs at a project instant. A curve tied to a clip or its source must travel with that mapping; a curve tied to project time must stay fixed. These public CLI/MCP journeys verify that distinction in delivered sound and pictures, using the accepted native retiming worker without changing production code.

The [gain report](gain-report.json.gz) compares every stereo PCM sample with dry retimed PCM multiplied by an independent cubic envelope. Preserve and follow each cover normalized clip, source-content and project clocks, including fractional activation, dry neighbors, joined query ranges and a pure split. All six cases have zero measured sample error. The fixed numerical allowance remains the existing gain gate's 1e-7; it was not widened. A deliberately linear replacement for the authored cubic fails the same oracle.

The [zoom report](zoom-report.json.gz) covers a moved, retimed and split counter video. Every encoded picture is checked for the expected physical source counter and the expected boundary of an asymmetric colored landmark. The independent cubic formula predicts the landmark's position and size; its two-pixel boundary allowance was fixed before the first render. A delayed curve exceeds that bound, and a shifted source sequence fails counter membership. Ordinary static processing at five independently calculated values produces byte-identical public PNGs.

Complete full/split/export decoded pixels agree. The fractional query starts between project frame boundaries and retains the same source and curve phase. All matching full/range decoded RGB frames are measured separately: the worst mean channel difference is 0.162331 and the largest individual channel difference is 22. Those measurements expose codec differences; this gate does not accept strict encoded color parity. Physical picture selection uses the exact project frame instant, while the movie's visible packet intervals use the existing integer-microsecond output clock. Both are checked.

## Visual scope

[Content-clock samples](full-sheet-1.png) and [project-clock samples](full-sheet-3.png) show the two trajectories. The [visual archive](visual-evidence.tar.xz) contains every direct capture, enlarged counter/bit/boundary crops, every decoded movie frame, complete sequence sheets and exact static-control comparison metrics. A fresh agent inspected all full/crop pairs and every sequence sheet; its qualified [verdict and review](review.md) retain all observations. The curated set was opened together in Preview for approximately five minutes, then closed after the non-blocking checkpoint.

The leading black interval is the authored move gap. Thin scaled/encoded fringes and low-contrast dark source markers remain visible, although labels and bits are readable. This fixture judges source membership and animation geometry; it does not establish screen-text quality, photography, strict color fidelity or perceived motion smoothness.

The retained [split movie](content-split.mp4) and [fractional range](content-range.mp4) are the exact containers consumed by the separate [continuous-playback check](../16-continuous-playback/README.md). The [project-fixed movie](project-fixed.mp4) is a control. Final harness reruns reproduce all reviewed PNG bytes and complete decoded movie RGB bytes; container creation metadata differs. The [verification record](verification.json) and [reviewed-run report](reviewed-zoom-report.json.gz) keep those identities distinct. This delivery pass performed no playback or listening itself.

## Reproduce

The existing entry points expose focused cases so this gate does not repeat the established unit-rate gain or static geometry cohorts:

```sh
SCREENREC_NATIVE=/absolute/path/to/frozen/screenrec-native node packages/test-harness/editing/gain-curves.mjs --case retimed --out /tmp/retimed-gain-fresh
SCREENREC_NATIVE=/absolute/path/to/frozen/screenrec-native node packages/test-harness/editing/keyframes.mjs --case moved-retimed-split-zoom --out /tmp/retimed-zoom-fresh
```

Use a fresh output directory and built CLI/service dependencies. The runners generate synthetic media and use isolated libraries. Existing default cases retain their established coverage; the obsolete retiming refusal is replaced by the focused successful-delivery case. The shared counter fixture owns its picture dimensions, rate and event positions so its consumers cannot silently disagree.
