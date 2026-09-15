# App-owned capture integration

The service now allocates capture identities, sends native controls over its private
channel, ingests lifecycle reports and reconciles stranded takes from recovered
media. CLI/MCP advertise the same capture operations through the shared registry.
This is capture-control evidence, not the completed personal app workflow.

## Root verification

The integrated core, protocol, service and CLI build/type/test run passed thirteen
Turbo tasks: 29 core, 9 protocol, 43 service and 3 CLI tests. All 26 packaged-app
checks passed, including the existing interpreter/startup/shutdown cases.

Root then reproduced and corrected a direct stop of an unproved start: a native
`complete` response could not transition the still-`preparing` catalog row, so the
first stop failed to register media. It now uses the same stop/recovery path as an
unproved replay. The real-channel regression failed before the fix and passes now;
the affected capture suite passes all 17 tests, and all 11 packaged capture checks
pass on the rebuilt app. An unresolved response reports the current catalog state,
including reports received while the control call was waiting.

Independent review found no further actionable regression after that correction.
Its native/socket runtime attempts were sandbox-blocked; root's real process runs
supply execution evidence. The review's earlier timeout, replay and synchronization
findings were reproduced and fixed before this checkpoint.

## Boundaries

Every actual recording here captures the app's own fixture window with microphone
and system audio explicitly off. Fixture mode also refuses enabled audio before
constructing a capture request. Microphone-on/system-off public defaults are
verified through the protocol/service boundary without recording a microphone.

Pending-start tests wait for an acknowledged fixture hold and named release, with a
bounded deadline. They no longer infer native receipt from directory creation.
Cleanup waits for owned processes to exit before removing scratch, and fails if a
process survives. Root also cleaned two abandoned processes from earlier temporary
quit experiments; their source paths had already been removed by those old runs.

The candidate's implicit old-catalog migration was removed to honor the fresh-format
spec. An old catalog without allocation arguments is rejected as
`UNSUPPORTED_CATALOG`; a regression confirms its bytes remain unchanged.

Still open: physical microphone/system audio, display/region capture interaction,
recording menu controls, artifact jobs, native worker parent lifetime and power loss.
No full end-to-end agent recording/inspection/edit/export claim follows from this
window-only control proof.
