# CLI test ownership

The CLI adapter suite verifies transport semantics. A case's incidental number of
fresh processes is not a documented five-second product performance contract.
The phase audit found setup, startup and service work distinct: the representative
flow took 1.86–3.07 seconds, with individual CLI processes taking 0.21–0.43 seconds
while warm MCP calls took 2–13 milliseconds. Pre-help CLI logic with the same
current dependencies took 2.39 seconds. These shared-host observations do not
establish a stable latency benchmark or a help-related regression.

Independent contracts now have separate cases at the unchanged default deadline.
The cohesive edit/replay/stale/undo/history integration remains together. Existing
per-call guards and real subprocess/transports remain. Production code is unchanged.

## Assertion mapping

| Prior assertion group | Retained owner |
| --- | --- |
| Complete MCP operation names and callable/default schema contract | Existing offline tools/list discovery case, with zero socket contacts |
| CLI recording-list exit status, exact recording identity/pagination and MCP parity | Dedicated real-service listing case |
| Cut spans, replay result, stale error parity/code, undo duration/spans, history operations | Original cohesive CLI/MCP edit case, unchanged assertions |
| Oversized CLI exit/error/request identity | Dedicated local-validation case with a nonexistent explicit socket |
| Oversized MCP structured LIMIT_EXCEEDED result | Existing identical oversized assertion in offline MCP discovery; duplicate removed |
| Malformed edit.trim isError and structured INVALID_PARAMS | Same request shape in offline discovery using a sentinel recording ID; zero socket contacts retained |
| Four invalid frame.batch parameter sets and structured failures | Four parameterized cases, same inputs and assertions |

No batch lease/partial-failure/collision assertion or media delivery assertion was
moved or removed. The earlier default-deadline failures and longer diagnostic remain
in the [discovery evidence](../25-cli-discovery/README.md). This test organization
change does not claim a production startup speedup or broader workflow acceptance.

The first complete default-deadline run reports 26 passes and 10 timeouts. The
cohesive edit flow and four invalid-input cases pass; the new listing case and
unchanged help/batch/media cases hit their deadlines under the shared load. This
is not a full-suite performance pass. Core behavior and per-call/default deadlines
remain unchanged; CLI types and the CLI/service build pass.

Independent review confirms the assertion mapping with no actionable defect. Its
runtime verification was limited by sandbox socket-permission errors and process
timeouts; that run is retained separately from ordinary execution.

The subsequent focused changed-case run passes six checks but times out in listing
and edit lifecycle at their unchanged five-second deadlines. No additional broad retry follows that result. After concurrent native/test work
reaches a boundary, one quiet run passes all eight changed cases at their original
deadlines (12 unrelated cases excluded). This verifies the scoped organization;
the whole-suite loaded-run failures remain open. The assertion review found no
lost coverage.
