# Output quality and size decision

Use 8 Mbps as the balanced H.264 default. Keep 3 Mbps compact and 20 Mbps sharp
as optional starting points; every resolved setting remains independently
configurable through the public settings schema. These are encoder targets, not
promised file bitrates. This policy is scoped to the tested offline H.264 backend
and is not a universal optimum.

The public journey holds source, composition, 1920×1080 canvas and 30 fps fixed.
Each cohort has four full-resolution pre-encode PNG references and matching
Apple-decoded frames for each candidate. ICC conversion to sRGB is explicit;
all RGB pixels enter the comparison without masks, blur or resized scoring.
The values below are file bytes and the arithmetic mean of four frame RMS errors.

| Cohort | Compact bytes / RMS | Balanced bytes / RMS | Sharp bytes / RMS |
| --- | ---: | ---: | ---: |
| Opening, 1 s | 124,184 / 2.750 | 115,713 / 2.434 | 145,602 / 2.273 |
| Scroll, 1 s | 254,072 / 2.710 | 249,442 / 2.352 | 315,849 / 2.162 |
| Recorded pointer/trail, 1 s | 131,155 / 2.755 | 123,081 / 2.439 | 155,353 / 2.275 |
| Scroll interval, 10 s | 2,102,858 / 2.376 | 2,240,120 / 2.193 | 2,533,654 / 2.109 |

Balanced has lower measured error and fewer bytes than compact in the three
short cohorts. In the ten-second cohort it costs 6.5% more bytes for 7.7% less
sampled RMS error; sharp then costs another 13.1% for 3.8% less error. Independent
inspection of all 64 reference/decoded images finds the strongest difference in
initial thin grid lines: compact breaks or doubles lines, sharp is closest, and
balanced is intermediate. Sampled text remains readable in every candidate;
there is no strong balanced/sharp text-legibility winner. These observations
support a reversible balanced default while keeping sharper output available.

## Evidence boundaries

The original four-code-level diagnostic still fails. This decision does not
replace it or close existing codec-fidelity gates. Four sparse frames per cohort
cannot establish continuous motion quality, long-run stability, audio quality,
or performance on photographs, dense code and other untested content. The
[visual review](visual-review.md) records those limits and its partial blinding.
Review crops retain every produced inspection sheet, including JPEG overviews;
fine-detail judgments use the lossless enlarged PNG crops and full PNGs.

The opening FFmpeg measurement has different absolute error but the same ranking.
Decoder results are named separately, never averaged together. A reverse-order
repeat produces the same file sizes and all 12 decoded PNG hashes. The source-only
motion scan selected the largest adjacent change before encoding; its downsized
screening images do not enter fidelity metrics. The first long trial failed in a
frame-selection command; its log is retained, and the corrected trial is `long`.

## Reproduction and provenance

Run `packages/test-harness/editing/output-quality.mjs` with `SCREENREC_NATIVE`
pointing to a built native worker and a fresh `--out` directory. The opening
uses defaults; motion uses `--start 40500000`; pointer uses `--pointer`; long uses
`--start 35000000 --duration 10`. The reverse-order confirmation uses
`--order sharp,balanced,compact`. Each compressed report pins source, worker,
settings, movie and reference hashes and preserves the original unpromoted
research status. The policy decision here is subsequent to those raw reports.

Compile `output-quality-decode.swift` with `swiftc -parse-as-library`, then pass
movie path and output directory. Long uses additional arguments
`0,100,200,299 300`; defaults select `0,10,20,29` of 30 frames. Run
`output-quality.py COHORT apple` with Python, NumPy and Pillow. The evaluator
verifies raw frame/profile/reference/movie hashes and exact presentation times
before scoring. Compressed retained raw BGRA files must be decompressed in a
scratch reproduction directory first. `sha256.json` pins the retained package.

[Acceptance-boundary audit](acceptance-boundary.md) distinguishes the preset
decision from remaining encoded-appearance verification; no existing diagnostic
or exact pre-encode gate is weakened.
