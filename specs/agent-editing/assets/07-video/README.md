# Compiled video execution

[Review disposition](review.md) records the resolved findings and remaining gate.

The [native journey](../../../../packages/test-harness/editing/video.mjs) sends
compiler records through the production worker, decodes its output independently,
and checks counter identity, frame timestamps, partial-frame durations and Rec.709
tags. The [temporal report](temporal.json) includes all eight frozen reproduction
cases plus backward source reuse, a project gap, a selected second video stream,
retiming, distant forward cuts/retiming, and a rational-rate window whose leading picture's clip has already ended.
These are native execution gates; public CLI/MCP delivery remains slice 09.

[Fresh complete-set visual review](visual/README.md) accepts temporal membership and contain geometry; broader codec quality remains open.

The [resource run](resource-run.json) compares three seconds with ten minutes of
held footage: 60 versus 12,000 encoded frames retain one decoded source sample.
Measured peak RSS is 36.9 versus 38.7 MB. The unchanged memory gate permits 128 MiB
additional process overhead, which rejects retaining all 12,000 decoded pictures.
The [first observation](observation-timeout.txt) exhausted the harness's generic
60-second subprocess budget; the isolated run finished within a 180-second
observation budget. This is no claim about realtime encoding at arbitrary canvas
sizes. Per-frame encoder progress remains bounded by its own deadline.

The [production `NativeWire` task cancellation gate](cancellation.json) waits for the render workspace,
cancels the task, drains it and verifies no final output or staging remains. A fresh worker then renders the same output path, whose decoded first frame exactly matches the verified held A1 image. Native
process death is still owned by the service attempt workspace; this task-level gate
does not claim that SIGKILL can run Swift cleanup. Refusal checks also verify cleanup,
including unsupported layers/visual processing, odd canvases, unproven acquisition,
and unavailable ancestors over a source's physically empty edit.

[Existing frame checks](frame-preservation.txt) pass. Matched old-renderer requests
for cuts and empty edits produce identical decoded-pixel hashes before and after
the shared sample-support/orientation extraction (see temporal report preservation).
The [falsification](wrong-source-red.txt) forces native source selection to zero and
fails the expected counter at frame 5; restoration passes the temporal journey.

The explicit profile uses the measured Rec.709 RGB target/encoder tags and platform
bitrate policy. Only temporal membership and that declared conversion are accepted
here. General text/photographic encoding quality, wide color/HDR, transparency,
image-source admission, visual processors and multiple simultaneous layers are
not claimed. No screenshots of the desktop, capture, playback or user-library access
are involved.

Build composition/core and the native worker plus `ScreenRecorderCompositionVideoTests`, then run:

```sh
SCREENREC_BASELINE_NATIVE=/path/to/pre-change/screenrec-native node packages/test-harness/editing/video.mjs --case repeat-reorder --out /empty/evidence/folder
```

`--temporal-only` is a focused rerun; its report explicitly marks resource checks
unrun. Omit it for the full gate. The baseline binary is required to reproduce the
existing-renderer preservation comparison; omission leaves that comparison empty.

Independent review found that unbounded sequential reuse decoded discarded middle
footage. [The red probe](sparse-forward-red.txt) reads 2,397 source samples for a
half-second sparse edit. The renderer now seeks whenever a forward source advance
exceeds one second; the same counter-verified cut reads two samples, and extreme
retiming reads ten. Nearby samples and holds still reuse the reader. These counters
measure returned decoded buffers, not codec-private keyframe preroll.

The [matched-profile probe](../../../../packages/test-harness/editing/video-profile-parity.mjs)
rebuilds the frozen native reproduction and selects its measured Rec.709/platform
writer settings. All eight cases compare decoded RGB bytes exactly against the
production renderer; audio is omitted on both sides because this is the video plane.

The current follow-up full run also exceeded its existing 180-second observation
budget; this remains an open full-run verification item ([retained failure](current-resource-timeout.txt)), not a relaxed performance
gate. The earlier successful resource run and the later failure are both retained.
Declared HDR (PQ/HLG), P3/2020 primaries and custom color descriptions require an
explicit supported transform. The new native plane rejects them instead of silently
flattening their range. Untagged input retains the measured native interpretation.
The H.264 profile rejects a nonopaque project background rather than choosing an
implicit matte. Tagged counter fixtures test refusal metadata, not HDR image quality.

The [source-profile refusal regression](source-profile-red.txt) first rendered all
three unsupported tagged fixtures, then passes after source-format validation.
The final temporal report records the actual PQ/HLG/P3 refusal outcomes and opaque
canvas policy. Independent focused review found no remaining color-admission issue.
The final matched-profile harness passes all eight exact decoded-byte comparisons;
its report is [retained](profile-parity.json).
