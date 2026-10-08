# First-class recording feedback evidence

## Purpose

Feedback review needs two kinds of evidence at the same time: bounded speech
that an agent can read and frames that show where the user pointed. The public
API now exposes both as review operations. `transcript.review` owns the
agent-facing preparation and polling path, including acquisition of Yap's
registered pinned speech model. `cursor.render` owns ephemeral visible pointer
trails for source and project selections. The lower-level evidence operations
remain available when an agent needs exact raw observations or explicit
lifecycle control.

## Principles and invariants

- `transcript.review` may prepare the registered model and bounded transcript;
  `transcript.get` is read-only and never starts inference.
- `cursor.raw` returns exact capture observations. `frame.get` stays clean.
  `cursor.render` is the explicit rendered-trail path and never writes a
  project revision.
- Source and project selectors retain their own clocks and provenance. Missing
  capture authority, gaps, off-crop positions and unavailable observations stay
  unavailable evidence; the service does not invent a pointer path.
- Every rendered frame is a real delivered artifact. Source trails are
  composited by the native source-frame renderer; project trails use the
  existing ephemeral composition and pointer-preparation owners.
- CLI and MCP call the same operation registry and share readiness, retry,
  pagination, generation and delivery semantics.
- Source media, capture evidence and authored projects remain immutable.

## Code pointers

The operation contracts live in `packages/protocol/src/operations.ts`. Service
dispatch and model preparation live in `apps/service/src/project-service.ts`.
Transcript lifecycle behavior is owned by `packages/core/src/transcript-processing.ts`;
project and source frame delivery are owned by `packages/core/src/frame-inspection.ts`.
Project cursor lowering is in `packages/core/src/project-window.ts`. Native source
overlay compositing is in `helpers/mac/Sources/YapFrames/SourceFrameRenderer.swift`
and `CursorOverlay.swift`.

The consumer contract is documented in `skills/yap/SKILL.md` and its media-workflow,
capability-discovery, MCP and helper references. `specs/done/feedback-review/choices.md`
records decisions that are easy to miss from the code alone.

## Verification

Protocol, core, service and CLI suites cover schemas, readiness, retries and
delivery. The native `YapFrameTests` executable renders both a clean source
frame and the same frame with a supplied trail; the regression asserts that the
delivered PNG changes while source bytes remain intact. The resulting baseline
and trailed PNGs were inspected side by side, and an unprimed visual critique
confirmed a visible magenta trail and pointer without clipping.

The repository-wide test command is otherwise green through the affected
packages; the macOS package's build is currently blocked by the workspace's
pre-existing missing `dist/sparkle/build-receipt.json` release artifact.

## Rejected approaches

Returning a clean source frame with cursor metadata was rejected because a
rendered-frame API must return pixels that already contain the requested visual
evidence. Creating a persistent project for review was rejected because
feedback inspection must not mutate authored work. Making callers discover and
download the speech model themselves was rejected because it hides the common
path behind an operational prerequisite.
