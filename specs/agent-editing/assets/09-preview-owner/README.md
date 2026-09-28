# Pinned composition previews

The [core owner](../../../../packages/core/src/project-preview.ts) binds an immutable
project revision to a requested interval before admission. Omitted intervals mean
the complete pinned project; empty or out-of-project intervals are refused. Later
edits and undo do not redirect queued work, retries or cache regeneration. Source
bindings come from admitted immutable assets and retain selected stream identities.
Revision asset references remain alive until the existing deletion coordinator has
drained jobs; this owner adds no separate lease/catalog/queue lifetime.

One injected renderer receives the compiler's lazy window, retained bindings and
reserved output path. It executes a fixed measured profile at the authored canvas.
The compiler owns picture phase, source mapping and exact absolute audio sample
endpoints, including positive windows with no audio samples. There is no translation
to recording spans or capture evidence. The service/native adapter owns attempt
workspaces, frame streaming, muxing and native cancellation.

Execution requirements start unresolved in the pure compiler. The deployed renderer
identity binds video/audio executors and its supported processor map binds gain on
audio and output targets. The same map supplies capability reporting. Unprepared
retiming or unsupported processors remain unresolved and cannot be admitted as ready
work. Implementation identity is part of the job input: changing the native executor
creates new derived work instead of reusing an older rendered result.

[Shared cached admission](../../../../packages/core/src/cached-derivative.ts) is used
by recording and project derivatives. Its policy remains the existing JobQueue
regeneration mechanism: missing cache bytes invalidate published readiness while
retaining pinned job identity. Native receipts must match the reserved file,
duration, authored canvas and actual byte count. Cancellation or failure removes
the reservation; the queue retains its existing late-result publication fence.

The [owner tests](../../../../packages/core/src/project-preview.test.ts) use real
project, asset, queue and cache owners; only renderer execution and fixture media
probe metadata are supplied at external boundaries. They verify historical bytes,
source bindings, compiler phase, regeneration, late cancellation, deletion draining,
implementation replacement, gain routing and failed receipt cleanup. A pin-to-head
mutation fails the historical-reuse test. Output-gain omission and absent compiler
sample endpoints also have retained red/green probes.

This is core ownership acceptance, not rendered-media or public CLI/MCP acceptance.
Native delivered output, listening and the public journey remain slice 09 work.
Broader core tests retain their original time limits; their recorded failures are
reported separately from the focused changed-owner gates.
