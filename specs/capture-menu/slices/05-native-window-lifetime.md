# 05 — Popover and Library window lifetime

Status: TODO. Dependencies: 01 and 03 production views.

## Contract

Unlock one transient capture surface and one independent Library window. The question is native dismissal, activation and singleton lifetime.

## API seam and ownership

Use an anchored transient NSPopover for the status-item presentation and one retained LibraryWindow. Platform anchoring/dismissal owns the ordinary lifecycle; do not add global monitors without a reproduced missing behavior. RecordingControls coordinates presentation and existing state; views still dispatch its actions. Open Library dismisses the popover, focuses/restores the existing window and preserves its tab. Outside click/Escape dismisses only the popover. Close/⌘W closes Library without quitting/stopping the service or take. Live recording overlays retain their nonactivating behavior. Automatic data refresh/shortcut failure reveal must not redirect source typing.

## Runnable or reviewable artifact

An explicitly invoked fixture opens the actual native containers with synthetic production-view facts. Observe popover dismissal, repeated Library opening, minimize/restore and close/reopen in one bounded run. Automated checks use scratch preferences and nonactivating/offscreen observation; human-open presentation is deliberate.

## Verification and what stays green

Test first at the actual window boundary, following settings-window and recording-overlays owners. Keep camera permission rows in Settings on this same permission/action owner. Extract the existing Settings main-menu keyboard installer for shared Library/Settings use, without a second menu installer. Verify single Library instance, retained tab, Escape/outside dismissal, Cmd-W routing, quiet probe/client launch and no activation from refresh. Capture exclusion is a decoded-media claim in slice 13: preserve existing app-exclusion filtering and do not infer it from sharingType.none. If NSPopover cannot satisfy focus/keyboard/exclusion together, record the reproduced conflict and reslice this boundary; replace it with one platform-appropriate container rather than carry two implementations.

## Visual variable and crop

Placement and reachability only: capture shell/anchor plus complete Library window at normal/constrained displays. Geometry is frozen from 01/03; palette is later. Compare against sharp selected layout and actual native before baseline; native arrow/shadow/chrome differences must be explicitly recorded.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

Internal window ownership/naming and normal platform animation are delegated. Lifetime/dismissal/activation contracts are fixed. Migrate ControlsProbe to observe the real surfaces and semantic actions when cutover occurs. Delete NSMenu-only presentation/probe state once migrated; retain no invisible compatibility menu for tests. Any short-lived wiring fixture ends at this cutover.

ControlsAction currently lives in ControlsMenu.swift alongside the renderer's MenuEntry and RecordingMenu. Preserve its cases and stable semantic IDs in the controls action owner when removing that file's menu machinery. Move shared recording title/status helpers to a presentation-independent controls owner and update RecordingControls and LibraryState directly. Saved-media/export semantics still needed by Library must survive the cutover under their natural owners; do not retain MenuEntry, an old renderer, or historical aliases to carry them into slice 07.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
