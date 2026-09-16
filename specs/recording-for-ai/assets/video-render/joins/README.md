# Production cut-join comparison

Target: a kept image must retain its readable frame label, upright orientation and
full framing immediately before and after each removed interval. Color and encoder
quality are measured separately; exact pixel equality is not this timing verdict.

These images were decoded from a fresh `lab:render-timing` execution of the actual
native renderer, not the exploratory writer. The retained `source.mov` and
`rendered.mp4` make the extraction repeatable. [The comparison receipt](comparison.json)
pins the worker hash, repository commit, movie hashes, exact plan, decoded sample
positions and PNG hashes. Every source and rendered full frame and label crop is
retained; no captured state was omitted from independent review.

| State | Playback instant (µs) | Source instant (µs) | Displayed source label |
| --- | ---: | ---: | --- |
| Before first join | 1,999,999 | 1,999,999 | FRAME 1 |
| After first join | 2,000,000 | 3,000,000 | FRAME 3 |
| Before second join | 2,999,999 | 3,999,999 | FRAME 3 |
| After second join | 3,000,000 | 5,000,000 | FRAME 5 |

Source sample indices are 1, 3, 3, 5; rendered sample indices are 1, 2, 2, 3.
FFmpeg `select=eq(n\,INDEX)` extracts the sample whose proven display interval
contains each named instant. These are displayed-sample comparisons, not claims
that a new sample exists one microsecond before the cut. The raw independent
movie decoding separately proves sample timestamps and exact four-second duration.
The label crop is x30/y55, 240×70 pixels, enlarged three times with nearest-neighbor
sampling. Full images stay at the native 320×180 size.

## Measured differences and visible judgment

Mean absolute RGB differences range from 6.45 to 8.00 of 255. Approximately 98–99%
of RGB components differ, so these are actual rendered outputs, not accidentally
reused source shots. Full-frame grayscale mean differences range from 2.04 to
4.14; the central-difference edge-energy ratios range from 0.995 to 1.025.
These metrics locate differences; they do not prove correctness by themselves.

A fresh image-only reviewer inspected all sixteen full/crop PNGs without code,
specification, expected labels or comparison metrics. Both groups visibly show
FRAME 1, FRAME 3, FRAME 3 and FRAME 5 in matching orientation and framing, with
high confidence. It also found colored edge halos, blocky smearing and softened
text in rendered crops, plus lighter green, darker red and shifted backgrounds.
The integrating agent sees the same defects. Source crops are cleaner; rendered
labels remain readable. The accepted variable is temporal membership/orientation,
not color or compression fidelity. Parent 13 must evaluate and resolve human-video
quality before presenting the encoder as a finished export.

Adversarial check: a mislabeled or duplicated still could conceal a bad cut. The
reviewed movie is therefore retained, and its independently decoded sequence is
0,1,3,5 at 0,1,2,3 seconds; the removed 2 and 4 never appear. Pictures alone could
hide time shifts, so sample timing and source support remain separate ledger proofs.

## Checkpoint decision

Source/rendered full frames and enlarged labels were opened together in one Preview
window for approximately five minutes while implementation continued. No response
arrived; the integrating agent accepts the timing/orientation variable on the
independent movie ledger, complete image review and direct inspection above. The
window was closed. This decision does not accept the documented color/encoder
fidelity defects; parent 13 keeps those explicit.
