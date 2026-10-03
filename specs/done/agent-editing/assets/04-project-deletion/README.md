# Project deletion evidence

The live [CLI/MCP journey](../../../../../packages/test-harness/editing/project-deletion.mjs)
imports a real corpus WAV through the native worker, places it, deletes its project,
and verifies retained media, removed revision references, fenced reads/edits,
repeat deletion and durable creation identity across a service restart.
[The retained report](live.json) records public calls. This proves state/lifetime
behavior, not rendered-media quality.

Run after building composition, core, protocol, client, service and CLI:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/project-deletion.mjs --transport both
```

The focused core checks pass 69 tests (projects/assets/jobs); service checks pass
13 (project deletion, project service, operations), with both package type checks. Protocol checks pass 16 tests and CLI checks pass 21.
The real queue lifecycle test holds a canceled executor open and confirms both
projects' references remain until it exits. Interrupting the coordinator leaves a
recoverable marker; resumption removes only the deleted project's references and
keeps the other project usable. A separate startup test proves the service resumes
a committed marker, and a paged-history test proves retirement advances in bounded
transactions. Future preview/export owner integration is not present or claimed.

Falsification: [missing lifecycle](missing-lifecycle-red.txt) fails before the core
implementation; [early retirement](early-release-red.txt) fails the reference
assertion while the canceled executor is still alive; [a no-op public delete
route](no-op-route-red.txt) fails the live project's disappearance assertion.
[An unbounded undo cleanup](unbounded-undo-red.txt) failed a 1,500-edit transaction-work bound; undo entries now retire in pages before the revision journal can disappear.
Each mutation was restored and the corresponding checks passed afterward.

No user library, microphone, camera, desktop focus or playback was used. All
services and media were confined to temporary homes and removed in finally blocks.

Review: the shape pass keeps the existing catalog, job queue and asset-reference
owner; the deletion coordinator only orders their lifetimes. Independent Codex
review identified the unbounded final undo cleanup described above; it is fixed
and verified red/green. The docs pass records retry and retirement invariants in
the contracts/architecture, and evidence links resolve. Lint reports only the
existing unused `sequence` destructuring warning in project listing. No new lint
finding remains.
