# Source picture choices for integration

- Rename the existing frame owner and export to MediaFrameInspection/frame-inspection,
  matching the audio owner, without a compatibility alias. Source/project planning
  stays distinct; derivative admission and publication remain shared.
- Source time means the physical picture containing that instant, not a nearby sample.
  Return exact sample support and preserve signed container clocks through the origin.
- Declared physical gaps and acquisition exclusions produce no synthetic black image.
  A raw source picture has no project revision, clip identity, canvas, overlay or tap.
- Share the existing color admission and oriented PNG sink; do not introduce a new
  color interpretation or route source requests through a synthetic compiled frame.
- Keep project ownership optional for a real source-only inspector. Tests verify it
  does not create project or recording tables. Existing project behavior is preserved.
- Keep still images, source scene/index generalization and remaining event categories
  explicit later work. A timed-video seam is not a completion claim for all 10d.
