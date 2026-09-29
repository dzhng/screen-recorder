# Private voice entry parity evidence

The private service binding launches the prepared Python sidecar through the same
JSON process lifetime used by native work. Existing render attempts own retained
reference copies, staging and cleanup after child/pipe closure; no voice queue,
asset store or model registry was added. Shipped executable/entry/pin hashes and
runtime/model checks replace caller assertions of preparation identity.

The real [journey](../../../../packages/test-harness/editing/voice-entry.mjs) compares
complete WAV bytes for both fixed texts against the frozen 18 oracle. This includes
every Float32 sample, header, channel/rate and frame count; there is no tolerance.
It also preserves the source/destination collision negative and tests preparation
and reference refusal. An injected shadow module proves isolated Python imports
use the verified installation; the same control failed before isolation. Dependency
versions and mlx-audio Python sources are checked, not arbitrary dependency binaries. For interruption checks it observes actual partial staging,
stops that owned Python process, then cancels or lets its deadline expire. Return
requires the process to be gone and its workspace empty. These are fresh process
checks with existing OS/Metal caches, not cold-system measurements.

Shared process/workspace tests separately cover malformed responses, worker crashes,
inherited leases, startup cleanup and process closure. The sidecar borrows those
owners directly. The model/runtime remain unchanged; no synthesis quality sweep,
reference-origin retention acceptance or listening claim is made. Public
`voice.generate` remains absent.

The private admission envelope is at most 120000 mono Float32 frames at 24 kHz,
with a 1 MiB encoded-file limit and 16 KiB per text field. Generation settings stay
frozen for entry parity. Widening these is future typed integration work, not an
accidental public API limit. Pins describe this verified preparation rather than
promising arbitrary Python environments or hardware will reproduce its output.
