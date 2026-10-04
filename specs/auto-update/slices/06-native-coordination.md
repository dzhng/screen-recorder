# 06 — Join native intent to the replacement permit

Unlock: the real app installs a proven candidate only after native, service and
launcher lifetimes jointly permit it. Depends on 01, 03, 04 and 05.

## Seam and artifact

One app-owned `UpdateCoordinator` wraps Sparkle callbacks. Existing countdown,
capture, export/save chooser and preview controllers report native blockers on the
main actor. Fence intent **before** countdown, permission/start preparation or a
save panel. Pause harmless polling only during the final fence; a live preview
remains usable and renewing while the update waits.

The coordinator joins native idle, the private `update.prepare` reference and 03's load/
swap exclusion, commits only while all remain valid, and invokes the retained
immediate-install block. Deferral/failure releases all tentative fences. Its update
shutdown is clean and non-escalating; ordinary `ServiceHost.shutdown()` and user/
system quit keep their existing meaning. No `closePreview`, forced finalization or
signals may be used to obtain updater idle.

The reversible boundary is before closing the control pipe. Until native/service/
launcher commitment, failure releases tentative permits and leaves the old service
usable. Pipe EOF starts irreversible service close; invoke it only after every
product obligation is gone, and prove clean child exit before replacement. A stalled
exit aborts installation, preserves the app/library and reports a shutdown failure;
it cannot promise restored admission in that closing process. Do not signal-kill,
start a competing service or swap while that child is alive. After proven child
exit, one bounded recovery launch may restore the old app's service; no restart
loop. If exit/recovery is unavailable, report actionable manual restart rather
than pretend readiness. Add the corresponding recovery limits to consumer guidance.

Shared protocol owns `UpdateStatus` and private control schemas; app callbacks
project status to the service, not another scheduler/defaults store. `service.health`
adds `version: string | null` from owner-derived bundled runtime metadata and
`update: {state, availableVersion, blockers, error}`. The version is the running
app/service release, not evidence that an already-live old CLI upgraded. States are `unavailable`,
`disabled`, `idle`, `checking`, `downloading`, `waiting`, `installing`, `failed`;
version/error are nullable, blockers are stable reason strings from existing owners.
Error is `{code, message, retryable}`. `unavailable` covers standalone service and
manual personal builds. No API promises a health response while disconnected;
connected prepared/committed admission returns `UPDATING` as in 04.

Human artifact: a packaged A→B fixture journey whose trace exposes exactly which
owner prevented installation and proves relaunch without capture or focus stealing.

## Proof and parity

First drive production callbacks/entry points with slice 01's frozen feed/archive
bytes and slice 03's barriers. Compare candidate decisions, signature failures,
URLs, install timing, termination/relaunch and complete failure/status projections.
Permitted differences: real app identity/paths and additional product blockers.
Any trust/installation difference is a named spec change, not cleanup.

Then add red/green native barrier cases for countdown/start/finalizing, chooser,
preview including preparing/late replies, publication, service work, polling and
new arrivals, real private-control permit correlation, lost replies and a stalled
child exit after EOF. Distinguish pre-EOF safe reopening from post-EOF failure;
assert no forced signal, competing successor or replacement while child lives.
Prove one clean-exit recovery launch or honest unavailable state. Prove the quiet relaunch path frozen in 01 preserves selected home
and defaults, and shows no Settings even with `showSettingsAtLaunch` enabled. Test stale permits and all failure-release paths. Prove ordinary
quit with staged update and opt-out disarming using the supported 01 mechanism;
a relaunch-only delegate is insufficient. Never permanently refuse ordinary quit.

Keep service-lifetime, recording/countdown, export/preview controls and shared
protocol fixtures green. Use existing controller runners before actual capture.
Remove production probe adapters when this production parity runner replaces them;
retain the frozen reproduction only as research evidence.

## Verdict and freedoms

Delegated: coordinator file names, callback wiring and compact blocker labels,
which must be defined once in protocol fixtures. The serialized fields/states,
no-interruption contract and supported upstream install mechanism are fixed.
Feedback changes this slice if normal controls/quit become unusable or the status
misstates what blocks replacement. Any generated visual shot inherits the README's
compare/preview gates; run unprimed screenshot-critique last before accepting it.
