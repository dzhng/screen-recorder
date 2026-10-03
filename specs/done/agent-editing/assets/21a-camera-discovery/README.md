# Public camera discovery preparation

The public controller and selected-device probe consume one camera enumeration
and authorization reporting owner in native capture. Camera descriptors report
identity and name without a default selection. The existing screen permission
gate on source listing remains intact; device status reports camera authorization
without requesting it. The public start schema still refuses camera selectors.

The selected probe's camera device types, order and name/identity projection are
preserved. Both its permission report and its existing authorization preflight use
the shared owner. Its explicit permission action is unchanged and was not run.

The [CLI/MCP test](../../../../../apps/cli/src/main.test.ts) uses the actual service
and native control pipe with controlled facts. It verifies camera identities,
order, empty discovery and every reported authorization state across both
adapters. Removing the new response fields makes that public journey fail.
Discovery and authorization have separate test inputs: unchanged populated
discovery is checked once through each adapter, while status is checked for every
authorization state. The scripted controller still checks discovery across those
states. The public test retains its existing deadline.
The [controller harness](../../../../../apps/macos/tests/capture-start-interruption.test.mjs)
compiles the actual native controller against scripted device and shareable-content
boundaries. It preserves existing race cases and adds passive discovery checks.
Its scratch override supports isolated offline verification; it does not alter
product capture or build a replacement installed application.

The executable-fixture sweep also updates the retained terminal-boundary journey's
idle control response. That journey's media experiment was not repeated. Frozen
media/clock/publication evidence retains its existing scope.

[Verification](verification.json) records gate results and limits; the
[merged focused gate](merged-verification.json) passes independently after the
assertion refinement. Independent root settled diff and shape review is clean.
No real hardware discovery, permission read/request, camera activation,
capture, audio playback, model work or installation occurred. Public camera start,
source result ownership, finalization and project adoption remain with parent 21.
