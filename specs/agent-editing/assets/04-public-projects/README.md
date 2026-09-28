# Public project state journeys

The [runnable harness](../../../../packages/test-harness/editing/projects.mjs)
uses actual CLI processes, the MCP adapter, the isolated project service, SQLite
and native asset admission. The [report](report.json) retains terminal command
parameters and outcomes for 20 scenarios. Scratch state is removed and all
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
and historical reads. Additional public checks verify prepared-media rollback,
no-op receipts, changed-argument conflicts, competing CLI writers, pinned history
pagination and replay after the head advances. Real corpus WAV/MOV files enter through native import jobs.
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

The integrated run exits successfully and removes its scratch service/home. An
independent review of the added assertions found no actionable defect; the new
matrix runs through CLI, while MCP parity is established by complete cross-adapter
replay, not a duplicate run of every case. Mutating the real service to violate
[no-op identity](noop-red.txt), [request conflicts](conflict-red.txt),
[concurrent revision checks](concurrent-red.txt), or
[pinned pagination](history-red.txt) fails the corresponding assertion. Restored
production paths pass. The [deletion checkpoint](../04-project-deletion/README.md)
also passes after integration, as do six project-store and seven focused service
tests. Together these complete slice 04's persistence/public-state boundary. Rendered split preservation, processing order, parent
mixing, denoise and voice quality retain their separate gates in the
[journey inventory](../../journeys.md).
