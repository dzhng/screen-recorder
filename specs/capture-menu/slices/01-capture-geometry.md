# 01 — Native capture geometry

Status: TODO. Dependencies: None. First pickup point.

## Contract

Unlock a production capture view that can be judged at native scale without a service or devices. The question is whether the selected density fits, including its footer and short-screen scroll limits.

## API seam and ownership

Build the capture view in the macOS app target with immutable rendering inputs and supplied callbacks. Its eventual production facts/actions come from ControlsState/RecordingControls. A small read-only presentation value may describe tiles, rows and statuses; it never owns selection, service state or a clock. The fixture can construct that value directly for future camera states without waiting for wire admission in 04, and records callbacks rather than implementing capture. Do not add test-only camera flags or a second mutable domain model. Use the existing controls module for currently admitted facts/actions; camera encoding and action integration stay in 04/06. The view owns only presentation. A proposed capture-view-shots.mjs runner follows settings-view-shots.mjs and compileControlsCheck. The runner must draw the production view, not a native copy of the HTML. Preserve the current app presentation until the shell cutover; the view is the replacement consumer, not a second state owner.

## Runnable or reviewable artifact

An explicit native fixture renders the idle, Camera Only-required, long-name and short-screen states. It allows source/device-row reactions with an action recorder and clearly labels all synthetic facts. Obtain an actual native current-menu baseline before replacing it. No service, capture, device enumeration or permission inspection is needed.

## Verification and what stays green

Invoke write-tests before introducing interactions. Check action applicability and that scrolling reaches every action; do not assert every spacing constant. Use offscreen native shots. Record actual points/backing scale and fill the frozen reference landmarks. Keep existing controls/Settings behavior green.

## Visual variable and crop

Silhouette and density only. Compare the complete capture boundary plus context, then grid, device-row and Start/footer crops against camera-idle-sharp.png and camera-only-sharp.png. Retain top/bottom short-screen shots. Palette, icon rasterization, actual device facts and recording functionality are explicitly later variables.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

View factoring, native control implementation and SF Symbol selection are delegated. Geometry and required content are frozen. If fitting requires smaller controls, a different card arrangement or reduced content, show the conflict and reslice rather than reinterpret approval.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
