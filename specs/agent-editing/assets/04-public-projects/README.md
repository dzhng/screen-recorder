# Public project state journeys

The [runnable harness](../../../../packages/test-harness/editing/projects.mjs)
uses actual CLI processes, the MCP adapter, the isolated project service, SQLite
and native asset admission. The [report](report.json) retains terminal command
parameters and outcomes for fifteen scenarios. Scratch state is removed and all
processes are stopped; the installed recording library is untouched.

Run after building composition, core, protocol, service and CLI:

```sh
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node packages/test-harness/editing/projects.mjs --transport both
```

Verified live state includes complete cross-transport replay, stale-head rejection,
late-batch rollback, restart replay, undo/restore, four processing target scopes,
ordered repeated gain steps and bypass, linked splitting with independent step
identities, audio replacement with preserved video and settings, explicit reset
and historical reads. Real corpus WAV/MOV files enter through native import jobs.
The compiler/native renderer is not invoked: **live media verification is pending**.
Gain capabilities honestly report execution unavailable.

The focused protocol (16), CLI (21), service operation/project-service (11) tests,
service type checking and affected builds pass. Independent Codex review found
two weak journey assertions: group/output writes needed read-back checks, and
replacement needed an explicit changed-source check. Both are fixed. Deliberately
dropping [group](group-red.txt), [output](output-red.txt), or
[replacement](replacement-red.txt) operations from the real service makes the
corresponding assertion fail; restoring the route passes. Disabling the entire
[edit route](disabled-route-red.txt) also fails. These are failure checks, not
production behavior or rendering evidence.

A fresh weaker agent given only the product skill and CLI help independently
created a project, copied gain settings to a second track using new step IDs,
bypassed the copy, undid the change, and correctly reported that no media was
processed. This validates the current skill/API path, not the full tutorial.

Slice 04 remains open for deletion lifecycle and the remaining public mutation/
history failure matrix. Engine tests cover additional cases but do not substitute
for those live journeys. Rendered split preservation, processing order, parent
mixing, denoise and voice quality retain their separate gates in the
[journey inventory](../../journeys.md).
