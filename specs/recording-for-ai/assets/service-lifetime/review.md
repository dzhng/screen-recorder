# App/service lifetime candidate review

Candidate9d9b9f6 passed its original lifecycle suite but is not accepted. Root kept
it isolated while correcting two reproduced startup failures:

- Twelve concurrent starts against a fresh temporary home announced two or three
  successful listeners in four of five trials. An earlier failed connect is not
  proof that a socket remains unowned when it is subsequently unlinked.
- The actual NodeRuntime resolver, compiled with a generated interpreter shim that
  ignores SIGTERM, was still blocked after eleven seconds. Root killed only its
  owned probe processes. This exceeds the overall startup budget and the same
  synchronous resolution blocks the app's main actor.

The JSON reports preserve measurements. Independent review also identified missing
stdout-error cleanup and a valid near-limit request whose enlarged error response
throws during framing. Those must be handled by bounded failure/cleanup paths.
No capture or permission prompts were used in these probes.

Correction work is in `/tmp/screenrec-service-fixes`, branch `fix/service-startup`.
It must serialize socket ownership with a process-lifetime OS lock, validate paths
before mutation, bound interpreter resolution and service startup together, and
clean up a noncooperative child without relying only on SIGTERM. Existing lifecycle,
transport and packaged-app verification must remain green. Preserve diagnostic PIDs
in logs while keeping ordinary menu text about app readiness.

Node24 remains the personal-host prerequisite. Recording its validated path in the
bundle is compatible with that existing scope; tester/public distribution remains
separate. There is no new user approval gate for this engineering choice.

This subpass does not implement capture control, catalog ingestion or persistent
jobs. Do not mark parent06 complete from idle process-lifetime tests.
