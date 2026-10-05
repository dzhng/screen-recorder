# Library paging backend checkpoint

The recording and project pages use separate service cursors: recordings move
backward with `beforeSequence`; projects retain `afterSequence`. The existing
[controller](../../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift)
owns page history, delayed-answer fences and visible source preparation reads.
Deletion retries retain the exact typed owner and captured title after navigation.

This is the backend portion of [slice 07](../../slices/07-library-browsing.md).
Window binding, page-local filtering and visual acceptance remain open. Project
cursor/state names need the coordinated consumer rename during menu cutover;
this pass adds no aliases. No devices, permissions, focus or media runs occurred.

Focused library-controls, existing preview/project-export controls, JavaScript
format/lint and diff checks passed. Red/green cycles reproduced malformed cursor
admission and an old preparation read starving current-page updates. Removing the
cursor-progress comparison produced red; restoring it produced green. The tests
retain bounded synthetic controller exchanges in their normal output; no large
new evidence logs are checked in.

Shape/diff/docs review is clean. Independent Codex review found no actionable
regression and passed the same production-source fixture through direct scratch
compilation after its SwiftPM runner hit sandbox cache restrictions. See the
[review result](codex-review.txt) and [choices](choices.md).

This checkpoint proves the controller behavior, not completed UI acceptance.
