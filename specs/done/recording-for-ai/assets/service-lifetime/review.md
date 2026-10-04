# App/service lifetime review

The initial candidate passed its original suite but failed independent startup
checks. These reproduced failures drove the corrected implementation:

- Twelve concurrent starts against a fresh temporary home announced two or three
  successful listeners in four of five trials. An earlier failed connect is not
  proof that a socket remains unowned when it is subsequently unlinked.
- The actual NodeRuntime resolver, compiled with a generated interpreter shim that
  ignores SIGTERM, was still blocked after eleven seconds. Root killed only its
  owned probe processes. This exceeds the overall startup budget and the same
  synchronous resolution blocks the app's main actor.

The JSON reports preserve measurements. Root also reproduced a valid 65442-byte
control request terminating the packaged service with FRAME_TOO_LARGE when its
error response expanded beyond the output limit (`control-response-limit-red.json`).
Independent review additionally identified missing stdout-error cleanup. Those must be handled by bounded failure/cleanup paths.
No capture or permission prompts were used in these probes.

## Integrated verification

The integrated app uses a process-lifetime macOS file lock before inspecting or
claiming the socket. Interpreter validation runs off the main actor with bounded
output and termination escalation, sharing the startup deadline with the child.
Control output errors settle through bounded cleanup.

Root built the packaged app and ran all 15 real-process lifecycle tests successfully
(`node --test apps/macos/tests/service-lifetime.test.mjs`); retained output is
[packaged-lifecycle.txt](packaged-lifecycle.txt). Five fresh-home trials of twelve
concurrent starts each produced exactly one owner and eleven conflicts; see
[concurrent-starts-green.json](concurrent-starts-green.json).

Independent correction review found another lifecycle gap: normal quit during
interpreter validation could orphan the probe. Root reproduced it with the packaged
app, then retained a regression that now passes. Startup resolution is a cancellable
Foundation operation; normal shutdown waits for its bounded in-flight probe to be
reaped and suppresses late service launch. This does not promise probe cleanup if
the app itself is forcibly killed during validation of a noncooperative executable.
The service's parent-death cleanup is separately verified through control-pipe EOF.

Node24 remains the personal-host prerequisite. Recording its validated path in the
bundle is compatible with that existing scope; tester/public distribution remains
separate. There is no new user approval gate for this engineering choice.

This subpass does not implement capture control, catalog ingestion or persistent
jobs. Do not mark parent06 complete from idle process-lifetime tests.

Final independent review of the cancellation patch found no actionable regressions;
its process tests were sandbox-blocked, so runtime acceptance uses root's actual
packaged run above. Root also forced fresh service/client/protocol test and type
checks with Turbo: all ten tasks passed, including all 22 service tests. Shape review
kept one control owner and used Foundation cancellation rather than another process
manager. The patch adds a bounded startup ownership handle, not another retry path.
