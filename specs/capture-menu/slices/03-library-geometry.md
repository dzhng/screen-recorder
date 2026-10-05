# 03 — Native Library geometry

Status: IMPLEMENTED/native UI fixture verified October 5, 2026. Dependencies: 01.
[Evidence](../evidence/03-library/report.md) records native geometry, focused
controls preservation and the quick UI review. Window lifetime and real Library
binding stay in 05/07; no service/readiness claim is made by the fixture. Parent
owns Preview/integration and global handoff. User requested lighter UI verification;
no further expanded harness or lengthy review cycle is required for this checkpoint.

## Contract

Unlock the selected Library layout as a production native view with synthetic facts. Judge saved-media spatial hierarchy independently from service reads and window activation.

## API seam and ownership

The Library view consumes LibraryState, ExportsState and existing storage facts, sends ControlsAction, and owns only tab/filter/scroll presentation state. A proposed library-view-shots.mjs renderer uses compileControlsCheck. There is no service client or polling loop in the view.

## Runnable or reviewable artifact

Offscreen and explicitly opened fixture views show Recordings, Projects, Exports, empty state and long/wrapped item details. Thumbnail slots use labeled sample evidence in fixtures; production can use already available truthful thumbnails or a source icon fallback. No new automatic thumbnail-decode job or invented image is authorized.

## Verification and what stays green

Verify all actions fit and remain reachable at constrained heights, and long IDs/device names do not displace status/actions. Use synthetic deletion/source-publication/export-cleanup states from existing types. Keep state/action semantics unchanged; data breadth and actions are slice 07.

## Visual variable and crop

Library layout and information placement only. Compare full titlebar/sidebar/content boundaries and complete representative rows to camera-idle-sharp.png and finalization-issue-sharp.png. Preserve an 88×56 concept thumbnail slot and row relationships. Colors, exact native chrome and sample thumbnail contents are outside this geometry verdict.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

Native view composition, truthful thumbnail fallback, initial window dimensions and truncation/wrapping are delegated within approved density. Initial content area must fit the selected proportions on the available display; compact screens scroll. New preview generation, editing controls and export-history queries are not delegated.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
