# 07 — Make the automatic-update opt-out clear

Unlock: a person can disable automatic updates persistently, including a candidate
already staged. Depends on 06's proven staged-disarming mechanism.

## Seam and artifact

Bind one control in existing [SettingsWindow](../../../apps/macos/Sources/ScreenRecorder/SettingsWindow.swift)
to Sparkle's effective preferences through the coordinator. Public releases default
to enabled automatic checks/downloads and idle installation. Off disables automatic
checks/downloads/install eligibility; it does not silently delete staged data.
Use Sparkle's persistent preferences, not a second saved boolean. Manual personal
builds show truthful unavailable/manual status.

Suggested label: “Automatically download and install updates”, with “Installs when
recording and background work are idle.” No new update screen or implementation
paths/keys in product copy. JSON health projects the same effective state.

Human artifact: toggle/relaunch demonstration and existing settings-window shots.
Use `SHOTS=<feature evidence directory> node apps/macos/tests/settings-shots.mjs`
with scratch defaults and app state, after reading its current usage.

## Proof and visual review

Write failing settings/controller cases for fresh enabled defaults, off persisting
across relaunch, staged opt-out, re-enable and personal manual builds. A disabled
app must not install on later quit. Keep permissions, login registration, shortcuts,
window persistence and quiet service-triggered launch green.

The sole visual variable is the update control's meaning, placement and legibility.
Archive before shots; capture light/dark and enabled/disabled/waiting/failure states
in feature-owned evidence. Judge the update section crop and whole-window clipping;
redesign of other settings is out of scope.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on
before/candidate. As the **last visual acceptance check**, run unprimed
[screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md).
Show accepted shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md).
Give about five minutes for non-blocking feedback while doing independent work.
If silent, decide on evidence, record why, close shots and proceed. No release
sign-off is introduced.

## Verdict and freedoms

Delegated: concise label/helper-copy refinement and reversible spacing within the
existing settings style. Behavior and preference ownership are fixed. Human
feedback changes this slice if the user cannot tell what Off prevents or whether
recording can be interrupted. Screenshots alone do not prove preference persistence.

## Settings presentation checkpoint

The [review evidence](../assets/update-settings/README.md) binds the production
SettingsView shots and focused model checks. Settings sends changes through
`RecordingControls.configureUpdates` to its owner and observes the owner's
answer, without writing a preference or optimistically changing the switch.
Manual builds show a truthful explanation. The existing Settings menu entry
remains the only route; no update command family or new window is added.

This presentation pass does not establish actual Sparkle persistence or staged
cancellation. Slice 06 supplies the owner/main wiring and its lifecycle proof;
final assembled acceptance confirms relaunch persistence and opt-out on quit.
