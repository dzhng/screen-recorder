# Retained native face observations

Face evidence describes the delivered upright raster. It contains every native
Vision rectangle and confidence, the actual Vision revision/macOS implementation,
and explicit no-face/error states. It does not establish a person's name, a
complete head silhouette, an edit target or permission to crop.

Every native face row also retains the landmark groups returned for that exact
rectangle and a `core`, `partial` or `unavailable` coverage state. The state is
quality evidence only: detector confidence is not promoted into a complete-face
claim, and no group is inferred when the landmark request fails.

[The checkpoint](../../../../packages/test-harness/editing/subject-observations.mjs)
owns invocation and selected inputs. [Frozen gates](gates.json) were authored from
source images before inference. [Native evidence](native-evidence.json) retains
all observations, exact native sample clocks, original hashes, immutable frame
pins, association rows, controls and failed localization comparisons. Its small
[contact sheets](shots/) provide the full sampled window; annotated detail shots
show native boxes in green and independent regions in magenta.

Delivery and association are green across every retained native frame from the
three short host windows. Planted movement, two simultaneous faces, a source-edge
face, full occlusion and metadata orientation are delivered natively. Metadata
rotation must reproduce upright bytes before it can certify oriented box space.
Tracker controls retain gaps, refuse identities after the declared horizon, and
reset on explicit scenes, detector errors and changed provider/raster domains.
Missing temporal support is never interpolated. [Public index evidence](public-index-evidence.json)
checks plain and face-enriched source/project indexes through both transports,
including native request forwarding, delivered receipts and ordinary cursors.

**Full-face localization remains red.** The frozen overlap requirement fails in
27 Graham frames as his hand covers his face and his head turns. The native
rectangle shrinks while its confidence remains high. The same source window
still supplies one continuously associated detector track, and every returned
center stays inside the independent region. These facts cannot turn the failed
full-face gate green. No threshold was widened and no rectangle was expanded to
match the oracle. Follow-up must distinguish independently authored visible-face
landmarks from a complete head region; it must preserve this failure if Vision
cannot support the requested localization. Scores are evidence, never quality
or permission to frame automatically.

The exact failure audit is retained in [failure-audit.json](failure-audit.json).
It records the two failed ranges (44–45 and 47–71), IoU 0.328–0.492, confidence
0.784–0.885, and the fact that every failed center remains inside the authored
zone. A fresh landmark-aware worker replay returned `core` landmark groups for
the contracted rectangles; that is useful quality evidence but does not recover
the hidden head area or change the frozen verdict. Confidence thresholding,
association, box widening and a relaxed IoU gate are therefore rejected as
corrections.

The retained result is also checked by
[`face-localization-replay.mjs`](../../../../packages/test-harness/editing/face-localization-replay.mjs).
That checker binds the exact evidence, gate, audit and native-worker identities,
recomputes every frame's IoU and center containment, and requires the 27 failed
ordinals to remain open. It is a receipt replay, not a second detector; changing
the boxes, thresholds, source set or failure audit is refused before a report can
be promoted.

A previous scratch metadata control was counter-rotated in the wrong direction;
its upside-down raster is retained in [failed-controls.json](failed-controls.json).
The corrected control is byte-identical to its upright input. Initial integer-us
sample rounding also repeated predecessor frames; that abandoned run is not
native-window coverage. The accepted capture uses ceiling requests and proves
every native rational sample separately.

Closeout review: the independent visual pass found no visible stretch, orientation,
or source-corner loss in the complete sheets. It did not certify continuous motion
between sampled frames, and enlarged detail crops are soft because the retained
fixtures are enlarged for inspection. Those are evidence limits, not detector
quality claims; the 27 full-face failures remain red.
