# Recorded-content bitrate regression

The scoped pointer improvement does **not** generalize to this recorded-content
cohort: requesting 40 Mbps produces exactly the same five decoded samples and
file sizes as platform defaults. The prior four-code-value whole-image diagnostic
still fails for both. Neither candidate is adopted as the production quality policy.

The [fixed plan](plan.json) extends the existing [one-factor trial](../06-pointer-encoding/README.md)
to the unchanged narrated-workbench recording at its native 3120 × 1970 canvas,
20 output frames per second. A one-second movie and a nonaligned
`[450001,650001)` microsecond window exercise different encoder histories.
The [report](report.json) pins sources, workers, exact requests, native receipts,
writer-input equality and all sampled measurements. This is a native production
entry test, not a CLI/MCP journey or new capture.

| Comparison with direct native picture | Mean RGB error | Maximum channel error | Fixed lattice |
| --- | ---: | ---: | --- |
| Full, frame 0 | 1.886 | 60 | Pass |
| Full, frame 10 | 1.884 | 51 | Pass |
| Full, frame 12 | 1.883 | 51 | Pass |
| Range, frame 10 | 1.897 | 61 | Pass |
| Range, frame 12 | 1.886 | 58 | Pass |

Both policies produce every value above. Whole-image errors above four occur in
roughly 0.25–0.39% of RGB channels. The unchanged 5 × 5 normalized lattice passes;
that cannot waive the full-image failure. Direct native PNG delivery is the
pre-encode reference here, not an assertion of absolute source color intent.
Both image stages are converted through their embedded profiles to sRGB before
comparison. Alpha channels are excluded from RGB statistics, never text or edges.

Full files are 173,081 bytes and range files 140,282 bytes under both policies.
At frames 10–12 each candidate's actual pre-append pixels and complete source,
color and timing trace match its parent. The five sampled decoded RGBAs are also
byte-identical between policies. Retained parent PNGs therefore represent both
policies, with the identity recorded in the report; both actual movies are kept.
The runner does not claim all unsampled frames are identical;
[independent review](review.md) separately confirmed all-frame decoded YUV equality
between policies for these two movies. Matched full/range
samples still differ under either policy, with maximum channel error 57.

A [fresh confirmation](confirmation.json) using the retained runner reproduces
all sampled measurements, range comparisons and writer checks. Single-run timings
are recorded only; concurrent work makes them unsuitable for speed comparisons.
No inference, speaker playback, installed-app state or source bytes were changed.

## Reproduction and next decision

Run `node specs/agent-editing/assets/06-recorded-rate/run.mjs <repository> <fresh-output> <instrumented-parent-worker> <40mbps-worker>`.
The workers are pinned in the report and built from the previous experiment's
single-setting patch. The runner compiles existing color-reference helpers and
uses the current composition compiler; preserve the pinned compiled frame JSONL
when reproducing against a later compiler version. Build the current TypeScript
composition package before running the source-driven harness.

Keep platform defaults as the production incumbent. All-intra is rejected;
40 Mbps remains a narrow pointer diagnostic. Next investigate preservation limits
of the current H264 color/chroma profile on the frozen pictures, independently of
rate control, before selecting a broader export profile. Do not keep increasing
bitrate on this recording when the tested change produces identical pictures.
