# Composed picture boundary

The final composed canvas is already rasterized and oriented. PNG delivery must
only apply its requested size bound and color conversion; treating it as a newly
decoded source reapplies source-edge sampling and changes the outermost pixels.
Source-video orientation and sampling retain their existing owner.

## Reproduction

Run the public CLI/MCP regression with a frozen native worker:

```sh
SCREENREC_NATIVE=/absolute/path/screenrec-native node packages/test-harness/editing/composed-border.mjs /tmp/fresh-border-proof
```

The same asymmetric artwork crosses the canvas boundary in one project and sits
inside a padded canvas in another. Comparing its common interior avoids making
source-edge filtering part of the oracle. The old worker fails (maximum RGB
difference 134, 660 changed channels); the candidate matches exactly. Both public
transports deliver identical PNG bytes. Retained reports and pictures record both
outcomes. An earlier control aligned source and canvas boundaries and differed on
both workers; it did not isolate finished-canvas delivery and was corrected by
using artwork that extends beyond the inspected canvas.

Eight 1920×1080 public frames from two one-second windows of the local
`fixtures/narrated-workbench/video.mov` also match their actual captured movie-input
buffers within one RGB level after ICC conversion. The existing four-level gate
is unchanged. Before/after changes are confined to the outermost rows/columns;
all interior pixels are identical. The reports preserve per-frame measurements.
This is pre-encoding evidence, not acceptance of encoded movie color or motion.
Full recorded images and captured buffers remain local scratch artifacts.

Native and service builds pass. Four native source/frame tests pass. Fresh visual
review inspected all 40 full images/crops/zooms: the candidate satisfies the
synthetic padding relationship and shows no obvious new defect in the recorded
frames. The reviewer could not establish a perceptible improvement in those
recorded windows; exact border preservation is the supported claim. Independent
Codex review found no actionable defects and checked harness syntax; native
execution was performed by the root run described above. The first historical
source-display harness attempt used an incompatible old wire format and failed
before measuring preservation; its result is not a rendering regression.
