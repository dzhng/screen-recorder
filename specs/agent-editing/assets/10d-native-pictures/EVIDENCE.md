# Direct compiled pictures — native checkpoint

This checkpoint verifies native execution, not the public frame/cache/delivery
journey. The original mixed-profile sheets are rejected comparison evidence; the
[corrected reference](../10d-picture-color/EVIDENCE.md) records the limited fresh
visual verdict. Selected-source stills, screenshot indexes and the remaining event
categories are outside this checkpoint.

## Ownership and timing

The movie and demanded-still entry points use one stateful picture executor.
Compiler records determine editorial sampling and visibility; the selected-track
presentation reader determines physical sample membership. The still passes the
completed Rec.709 canvas raster to existing PNG delivery sizing, without a movie
roundtrip. PNG media type describes the file; `h264-rec709` names the shared
rendition policy rather than claiming the file contains H.264.

A picture receipt distinguishes no-layer background, compiler-excluded source
support, physical empty media and an available selected sample. It preserves
source identity even for unavailable pictures. Native sample value/timescale and
source origin retain exact physical timing; integer `actualSourceUs` rounds the
physical sample to microseconds, halfway away from zero, then subtracts origin.
The generated fractional-rate fixture proves those are distinct representations.

## Verification

The [harness](../../../../packages/test-harness/editing/compiled-picture.mjs)
consumes the existing independently asserted movie corpus. It compares every
picture identity to that corpus, every movie's decoded pixel hash to the frozen
native build, and the demanded receipt to the supplied compiler record. Default
execution covers the whole corpus; `--case` is an explicit focused runner.

- `frame-report.json` and `frame-receipts.json`: restored sequential run, 18 cases,
  386 demanded pictures; default and explicit delivery sizing, bounded encoded
  output, strict unsupported fields/layers, and cancellation staging cleanup.
- `provenance-report.json`: focused leading-partial case plus physical-empty and
  fractional-sample proofs, with the same delivery/refusal/cancellation checks.
- `movie-report.json`: complete existing movie gate, including every-frame timing,
  11 refusals, recording-render preservation, 600-second held output, bounded
  memory, cancellation and restart. The hold decoded/rasterized once across
  12,000 output frames; peak RSS stayed below the short-output measurement.
- `timing-mutation.log`: shifting physical selection by 250 ms produced A1 where
  the independent corpus requires A0. Restoring the source passed the full gate.
- `recording-frame-tests.log`: existing recording frame behavior passes unchanged.

The first independent Codex review found no actionable defect. Its attempted
build failed in local toolchain/module-cache setup; this is not runtime evidence.
The separate isolated native builds and real native runs above provide that proof.
A second review of the final harness/evidence also found no actionable defects;
its syntax/diff checks passed, and it inspected retained native results without
independently reproducing them.

## Frozen-baseline self-repeat finding

The initial complete run matched decoded movie pixels exactly. During a later
concurrent heavy movie run, the unchanged frozen native itself emitted a different
VFR-tail encode. Both originals are retained in `baseline-self-repeat/`. The
comparison changed only frames 32–39: frame 32 had RGB MAE 3.9087 and maximum
channel difference 208; later changed frames had MAE at most 0.1584. Sample times
and durations stayed unchanged. This establishes a baseline self-repeat failure,
not a defect attributable to the new executor.

Three bounded sequential baseline repeats and the candidate then matched exactly
(`baseline-repeat.json`). The final full gate was run sequentially and passed;
no comparison tolerance was changed. Pixel-hash equality remains the gate, with
bounded failure diagnostics rather than an enormous buffer dump. This does not
claim H.264 byte/pixel determinism under concurrent system load.

## Visual review inputs

The original `visual/` sheets are retained as a **rejected color comparison**: the
contact-sheet operation combined different transfer encodings without preserving
their independent profiles. The [common-profile comparison](../10d-picture-color/EVIDENCE.md)
owns the corrected reference and its limited fresh-review verdict. No production pixels
changed. In these original sheets, each pair is demanded PNG on the left and
movie-decoded PNG on the right, four pairs per row, chronological reading order;
unused cells are black. Red upper-left and green lower-right corner landmarks,
readable picture labels and centered letterboxing provide an asymmetric target.
The acquisition-transition/return crops show actual picture-to-gap boundaries;
the boundary-window crop is honestly all gap. The source corpus and movie gates
own expected picture identities. PNG/container/color-conversion differences are
not a claim of new codec or color fidelity.
