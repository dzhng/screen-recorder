# 15a — Bounded personal-app discovery

Status: implemented with temporary-app and actual-service fixture proof. The
installed personal workflow remains open in [15](15-personal-release.md).

## Contract and ownership

[The client](../../../packages/client/src/discovery.ts) owns socket selection and
one optional ordinary app launch. CLI and MCP validate requests against the shared
protocol before discovery; help and tool listing remain offline. Explicit sockets
bypass discovery. Health probes establish readiness without delivering the caller's
operation, which is then sent exactly once through the unchanged correlated
transport. A lost reply never causes an automatic mutation replay.

One startup timer covers initial health, filesystem inspection, launcher execution
and readiness. Cancellation aborts pending probes and the launcher; an already
launched app remains alive. Async filesystem completion checks cancellation before
launching, so an expired attempt cannot start an app later. The operation's existing
transport timeout is separate from this startup budget.

The [CLI instructions](../../../apps/cli/README.md) own connection selection and
personal-path configuration. The launch passes the resolved home explicitly with
macOS `open --env`, including when the override is empty. LaunchServices keeps an
already-running app's environment; a different requested home therefore fails
boundedly rather than silently connecting to the wrong library. Concurrent callers
each have at most one launch attempt; LaunchServices and the service's existing
single-owner rule arbitrate process ownership.

## Verification and review

Verified on the macOS host with Node 24, without launching the recorder or capture.
Commands: focused client/CLI builds and `check-types`; client `test` (21 passed), CLI
`test` (7 passed); scoped `oxlint` and `oxfmt --check` (clean).

- Local `/usr/bin/open -h` confirms `-g`, `-a` and `--env` semantics.
- Client tests use temporary executable `.app` bundles and real sockets. They cover
  serving/no-launch, absent/invalid bundle, actual launch with custom-home delivery,
  timeout, cancellation, explicit socket, concurrent readiness and an initial probe
  consuming the entire budget. Controlled delayed filesystem inspection proves both
  cancellation and timeout prevent a late launch. A Node launcher fixture proves a stalled
  launcher is killed at expiry.
- CLI/MCP subprocess tests cover actual service layout from cwd `/`, concurrent
  correlated requests, offline help/tool listing, invalid/oversized calls, and a
  lost mutation response delivered exactly once. Existing edit/replay/stale/undo
  parity remains green.
- Regression: invalid edit parameters originally reached discovery and returned
  APP_NOT_FOUND. The consumer test failed before shared-schema validation and
  passed afterward. Frame-size validation also precedes discovery.
- Shape/diff/docs review replaced separate stage timers with one abort budget,
  removed excess discovery commentary, fixed canceled filesystem-to-launch handoff,
  corrected empty-home propagation and fixture cleanup, and retained transport
  behavior unchanged. No dependencies or service/native changes.

Pickup: integrate and independently review with the concurrent work, then prove
ordinary launch against the installed real app and repeat the full personal
journey. Temporary bundles prove LaunchServices mechanics, not app packaging,
permissions, signing, native startup, or recording behavior.


## Integrated checkpoint

Root integration passes 21 client tests, 7 CLI/MCP tests and seven affected build/type
checks. Independent Codex review found no actionable regression; its socket tests
were blocked by sandbox EPERM, so root ran them with the actual local transport.

A real packaged-app launch from cwd `/`, using `SCREENREC_APP` and a fresh
`SCREENREC_HOME`, reached service readiness in about 0.31 seconds. The returned home
matched the requested library. Capture status remained idle, screen access was false
and microphone access undetermined, and both app and service exited normally after
review. See [launch evidence](../assets/discovery/real-app-launch.json).
This is the built app in the checkout, not an installed distribution or a recording
permission test; those remain with 15.
