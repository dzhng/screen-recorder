# Selected source transcript service integration

The isolated project service now exposes source transcript reads, literal search
and explicit retry through the shared CLI/MCP registry. Asset stream and optional
acquisition selection use the composition media binding schema. No recording,
role or revision is manufactured. Source cursors pin selection, support and
transcript generation; source windows preserve original word ranges and report
query clipping separately. Recording/package routes retain their actual domain.

Model preparation is explicit and outlives an individual socket request. Reads
report missing models without downloading. Service shutdown cancels preparation
and awaits its cleanup before releasing ownership. The final model-preparation
participant now settles only after the shared download finishes cleaning staging;
other canceled participants can still leave a joined download running.

## Verification

Root integration builds core, protocol, service and CLI; service/core types pass.
The focused public service gate passes 14 tests, including imported source reads,
search and retry with absent models. Protocol passes 17 tests; selected source,
recording, portable-page, ownership, job-admission and acquisition tests pass 38
checks across seven files. These are focused invocations, not a full release run.

The model cancellation regression failed before the fix: after awaiting canceled
preparation, status still reported preparing with 1,024 bytes and staging cleanup
pending. Removing the old polling allowance exposes the race. After the fix all
14 model tests pass, including a canceled participant leaving another active.

Independent review found stale CLI advertised-schema assertions after expanding
transcript selection. The protocol now advertises one flat union of recording,
package and selected-source variants; adapter assertions include all three. All 11 actual CLI/MCP adapter tests pass
after the change; the 17 protocol tests and service/CLI types pass again.
The reviewer could run types but its socket tests were sandbox-blocked; root's
service gates above ran against real scratch sockets. Actual native transcript
and differing-mask media acceptance remains the ongoing source-evidence journey.
