# 10d — Direct project frames and retained screenshot inspection

Status: in progress; compiler/core picture planning and native extraction are implemented. Public/source/index integration remains open; fresh visual review found a color/brightness discrepancy that is being investigated. Dependencies: [09](./09-first-preview.md), [10b](./10b-source-acquisition.md), [10c](./10c-occurrence-queries.md).

## Contract

An agent receives source/project frames and retained screenshot-index results with
correct occurrence, time domain, revision and generation identity through CLI/MCP.

## Seam and ownership

Source frames use the existing selected-source decoder. Project frames consume the
compiler's globally phased picture instructions and the same compositor as movie
previews; do not render and decode a temporary MP4 to obtain a still. Extract only
the reusable compiled-picture execution boundary from the existing native owner.
Readiness/capability binding is shared with preview and later audio inspection.

Retained screenshot selection/index keeps its existing lifecycle and bounded
readers; project coverage uses the occurrence-query owner. Jobs, cache, delivery
and deletion remain the shared owners from 09.

## Work and review surface

Extend existing frame/index registry operations with flat source/project selectors.
Return declared sampling/visible times and exact context pins. Source indexes remain
raw-source evidence; a processed project frame is explicitly distinguished. Gaps,
holds, unavailable acquisition and repeated uses retain their identities.

```sh
node packages/test-harness/editing/frame-evidence.mjs --fixture repeated-picture
```

## Acceptance

Delivered still membership/timing matches verified preview/export for boundary,
interior, held and leading partial pictures, repeated/reordered sources and selected
acquisition gaps. Use asymmetric landmarks to verify orientation/framing. Test
paging/index coverage, source-generation changes, eviction, cancellation, deletion
and cross-transport delivery. Unsupported processors/profiles refuse consistently
with preview. Existing recording/package frame/index gates remain green.

## Visual acceptance

Judge picture membership and framing in contact sheets and boundary crops, not
new styling. Compare against the named preview/corpus using compare-screenshots;
run a fresh unprimed screenshot-critique as the final visual check. Retain hashes,
shots and verdicts. Human review is non-blocking under the spec's standing review
procedure; no listening or broader codec-quality claim follows from stills.

## Failure boundary and discretion

Do not create a second layer/transform interpreter or bypass source availability.
Unimplemented pointer/geometry features remain their named later gates.

Delegated: extraction of the coherent native picture executor and index storage
representation. Sampling, capability, identity and single-owner rules are fixed.
Update slice Status and the README handoff after verified passes.


## Picture planning checkpoint

The compiler now selects the video plane through the same contributor, processing
and execution-window owners used by movies and audio inspection. A narrow request
inside a frame retains that frame's global sample timestamp; unrelated audio
retiming and audio processing do not block the picture. [Focused evidence](../assets/10d-picture-window/README.md)
covers this pure planning prerequisite, not delivered-image acceptance.

The [core demanded-picture lifecycle](../assets/10d-project-frame-core/README.md)
now pins requests and checks native receipt identity under the shared job/cache
owners. Its controlled-renderer tests do not establish native or public acceptance.
Concurrent frame and movie staging must share safe workspace lifetime before
the service route is integrated.
## Native checkpoint

Demanded PNGs and movies share one compiled-picture execution owner, including
selected-stream physical membership, support masking, orientation and the canvas
raster. Delivery bounds apply after that raster. Receipts preserve compiler time
separately from the actual physical sample and distinguish unavailable pictures
from an empty canvas. The [native checkpoint evidence](../assets/10d-native-pictures/EVIDENCE.md)
records the executed gates and the still-pending fresh visual review. This does
not close the public delivery, selected-source or retained-index gates above.
