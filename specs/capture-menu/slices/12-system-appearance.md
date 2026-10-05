# 12 — Native appearance and contrast

Status: TODO. Dependencies: 01, 03, 06 and 07.

## Contract

Match the selected warm-neutral/blue hierarchy in system light/dark appearance. The sole visual variable is palette/material/text contrast; geometry and behavior are frozen.

## API seam and ownership

Use the production native views and shared app visual primitives. Apply semantic appearance/contrast choices without copying a web CSS framework or adding a parallel design system. System appearance drives both surfaces. Primary/secondary text, blue selection/checkmark, switches, Required badge and recovery actions retain distinct readable states.

## Runnable or reviewable artifact

Actual-size matched idle, Camera Only, permission, service-unavailable, paused and finalization states in light/dark, plus long labels/increased contrast. Retain a contact sheet and individual originals. Library status/action colors reflect existing facts; no palette effect invents readiness.

## Verification and what stays green

Geometry checks from 01/03 remain green. Inspect enabled/disabled/selected text against adjacent card surfaces, inline Allow/Retry against its error surface, and foreground icons against borders/shadow fringes. Native system fonts/SF Symbols are expected; do not normalize typography/app scale to force pixel equality.

## Visual variable and crop

Palette, material and contrast only. Crop selected/unselected card interiors with labels/checkmarks, device/switch rows, primary action, required/error/footer blocks and equivalent Library status rows. Compare sharp light/dark concepts; shadows include their full tails/context. Density, query breadth and acquisition behavior are outside this verdict.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

Semantic color/material selection and small native typography tuning are delegated to achieve the approved hierarchy. Changes to approved card/row geometry or the source/action arrangement reopen the owning geometry slice. Accessibility contrast matters more than literal sample-thumbnail/color equality.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
