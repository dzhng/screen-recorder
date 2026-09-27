# 00 — Freeze fixtures and preservation evidence

Status: not started. Dependencies: none.

## Contract

A fresh implementer can reproduce every input and distinguish existing verified behavior from pending acceptance. This is the next pickup; no production editor changes belong here.

## Seam and ownership

Create `packages/test-harness/editing/fixtures.mjs` and a feature-owned corpus manifest. Record the current source commit, source-media hashes, generation scripts, tool versions and preservation-test paths. Reuse the real narrated fixture without altering it.

## Work and review surface

Generate two asymmetric numbered clips with different dimensions/frame rates, independent tones/impulses and explicit expected sample membership; add orientation, still-alpha, odd-canvas, missing-stream and gap cases. Freeze manually labeled filler/repetition targets and protected words in real narration. Capture existing single-source reference outputs in an isolated library. Keep physical webcam and independent audition gates pending if unavailable.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/fixtures.mjs --out specs/agent-editing/assets/00-corpus
```

## Acceptance

Re-running generation produces the declared deterministic assets. Every manifest member hashes correctly. Expected source membership is hand-specified. Run and record the existing narrow timeline/library/preview and relevant native preservation suites; inherited failures remain visible. No personal library or installed app is modified.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If a named existing harness differs from the map, locate its actual entry point and correct the manifest. A missing real input gets a labeled stand-in plus a replacement slot; it cannot close the real-media quality gate.

Delegated: Fixture colors, internal script layout and report formatting. No changes to the user's scope or acceptance meanings.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

