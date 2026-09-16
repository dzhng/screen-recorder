# Core trail planner checkpoint

The planner composes the existing source-evidence index and shared scene analysis;
it does not choose video samples independently or rasterize images. The native
renderer remains the drawing owner. The [tests](../../../../packages/core/src/trails.test.ts)
use real SQLite evidence and injected bounded visual observations, including the
native-normalized buffered-pause fixture retained beside this report.

## Verified contracts

A held frame preserves a later circle. Selecting identical future pixels does not
import a subsequent wave; selecting changed future pixels yields an explicit empty
eligible overlay and future-scene reason. Moving the cursor lookup and page end to
the later decoded time made the circle test fail with the unwanted wave; restoring
the requested-time boundary made it pass.

Cut, pause, scene and changed-epoch resets clip history. Points exactly at a pause
boundary are conservatively omitted: buffered journal delivery cannot prove which
side they belonged to. Ineligible readings split runs, and the last normalized
observation wins equal cursor timestamps. An unknown latest observation never
resurrects an earlier pointer. Native-normalized input remains byte-identical.

A moved window can use current-epoch coordinates over an older held image when
contentRect, scale and output dimensions agree. A resized content rectangle vetoes
that overlay. Repeated same-epoch timing confirmations do not reset a run. Unplaced
geometry without a matching next timed placement, missing geometry/reference or an
unpublished generation stays explicit failure; cancelled scene preparation propagates.

A pointer older than the requested history can survive at its actual observation
time when sampled visual endpoints agree and no indexed reset intervenes. A known
changed endpoint omits it. Two-minute gaps use bounded endpoint observations, not
an expanded sampling grid. This intentionally inherits scene sampling's inability
to prove that no intermediate change-and-return happened.

## Bounds and ownership

The existing raw-page maximum bounds work to 5,000 observations per request;
exceeding it fails explicitly. After equal-time selection and eligibility filtering,
at most 1,200 trail points reach native, with a separate explicit error instead of
truncation. Both cap refusals and the inclusive 1,200-point success are tested.
Pointer-only requests draw no trail. Default duration stays two seconds; shared
scene validation enforces the ten-second maximum.

The only added evidence query seeks the next timed geometry placement through the
existing index with LIMIT 1. The planner does not reinterpret host clocks or add a
second scene detector, queue, storage table or public operation. Geometry records
are kept as provenance, not transformed into a second coordinate implementation.

## Verification and open gates

All 12 planner tests and all 127 core tests pass; core build/type checks and focused
lint pass. Visual observations here are injected boundary inputs: real rendered
cursor appearance, clean-vs-overlay pixel comparison, native selected-frame parity,
public defaults and independent visual acceptance still belong to integration.


Independent Codex review found no actionable defects and passed the then-current
27 focused planner/evidence tests and core type check. Integration review corrected
the boundary label to kept_start: a retained span beginning at source zero is not
itself proof of an edit. A further future-identical-frame pause regression passes.
No rendered default is accepted by these core-only checks.
