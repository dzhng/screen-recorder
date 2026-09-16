# Public playable preview

The shared operation registry now admits revision-bound previews through the app
service, CLI and MCP. Pointer scheduling and native movie rendering run inside the
same inherited-descriptor workspace owner. Startup clears abandoned staging before
opening the catalog or admitting jobs. Preview preparation does not depend on a
speech engine.

The bundled-app test in `apps/macos/tests/preview-inspection.test.mjs` exercises the
actual service with a generated silent source and recorded cursor/pause observations.
It proves historical revision pinning during another edit, decoded cursor movement,
absence of a trail in video, pause and cut resets, byte-identical CLI/MCP delivery,
cache eviction and regeneration after restart, and deletion revoking an open lease.
Original video bytes remain unchanged before the explicit fixture deletion.

[Public results](public-tests.txt) cover that route. [Mutation evidence](public-mutation.txt)
records its failure when the service omits the pointer schedule from native rendering;
the restored renderer passes. This distinguishes delivered visual behavior from a
metadata-only assertion. Native timing/composition also passed all 17 focused tests
on the merged tree ([results](../pointer-composition/merged-tests.txt)).

The work reuses bounded transfer leases and the existing job/cache owners. MCP
returns movie metadata and a transfer token; clients read bounded chunks and close
the token. CLI streams those chunks to an exclusively published output file.
Neither interface buffers the complete movie in memory. A download must finish
within the existing transfer lifetime; expiration is explicit and retryable.

Preparation has finite disk/work budgets: presentation evidence, emitted pointer
states, and inspected input events each stop with an explicit failure at their
bound. These are admission limits, not truncation policies. The existing native
presentation and core schedule tests exercise byte/event exhaustion and cleanup.
The production values leave headroom above the short walkthrough target, but do
not promise every arbitrarily long or dense recording will render.

Scope remains generated silent media. App player lifetime, actual speech audition,
physical captured gestures, and full export workflows remain open gates.

## Review corrections

Independent Codex review found a real deletion gap: a failed staging cleanup could
leave rendered bytes after the catalog reported successful deletion. Deletion now
uses the same locked workspace cleanup after draining recording work, and retains
its durable deletion marker if cleanup is busy or fails. The public test verifies
abandoned staging is removed; [the deletion mutation](delete-mutation.txt) fails
with the staged MP4 still present when that admission call is omitted.

A separate review found startup converted the retryable workspace-busy error into
a permanent generic failure. The actual service-process regression now holds the
workspace from another process and verifies the precise retryable failure, no
listener, and untouched staged bytes. [Service gates](service-tests.txt) cover
lifetime, render ownership and recording deletion. The earlier broad reviewer run
hit sandbox socket permissions; it is not counted as runtime verification.

Follow-up read-only Codex review confirmed both lifetime corrections and found no
remaining defect within that scope. Host verification passed the public bundled-app
flow, 34 service tests, 21 CLI tests and 10 protocol tests; service types and focused
lint pass. Shape review retains the existing renderer, scheduler, cache and transfer
owners: the public pass adds two operations and their composition, no new queue,
table, dependency or configuration surface.
