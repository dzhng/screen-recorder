# Public trail boundary verification

The existing [public fixture](../../../../apps/macos/tests/trail-inspection.test.mjs)
runs the bundled app, service and native worker on generated video and a synthetic
capture journal. Its additional cases verify retained-cut/current/historical
revision behavior, moved-window output coordinates, incompatible resize vetoes,
outside/unknown duplicate observations, missing geometry and explicit source retry.
Images are delivered through the CLI and decoded for pixel comparisons; the
original fixture continues to compare CLI files with MCP image bytes.

## Evidence limits

A denser encoding supplies a valid retained frame for the cut comparison. The
sparse encoding remains the held-frame geometry/timing fixture. Desktop placement
and cursor eligibility come from synthetic journal rows, so this does not prove
physical acquisition. No audio or screen capture is performed. Slice 10e and the
parent gesture/readability gates remain open.

The retry fixture removes write permission from its own derivative output directory.
That causes a real recoverable storage failure without corrupting source media or
inventing an internal worker stub. After permissions are restored, frame retry and
polling must retain the failed source dependency until explicit processing retry.
Missing geometry separately produces unavailability with no delivered image;
clean delivery remains usable in both cases.

## Verification

- `bun install && bun run build` builds this worktree's own signed app bundle.
- `node --test apps/macos/tests/trail-inspection.test.mjs
  apps/macos/tests/audio-inspection.test.mjs
  apps/macos/tests/sparse-frame-inspection.test.mjs` passes all 12 generated-media
  cases, including eight public trail cases through native delivery.
- Focused `oxlint`, `oxfmt --check`, and `git diff --check` pass.
- Mutation proof: disabling raster incompatibility in the real planner makes the
  resize test fail on 2,548 unexpected changed pixels. Restoring it returns green.
- Mutation proof: making frame retry implicitly retry source processing makes the
  failure test report `processing` instead of the required unchanged `failed`
  dependency. Restoring it returns green. Neither mutation is committed.

Shape, code and documentation review retain one fixture and one delivery helper;
there is no new production API, policy, dependency or harness. This pass adds
behavioral verification, not a visual treatment or a physical-capture claim.
Independent `codex review --uncommitted` found no actionable static issue; its
sandboxed native run timed out before app/service startup and supplies no runtime
proof. Host verification caught and corrected a test-only non-JSON revision request
before the final combined green run.
