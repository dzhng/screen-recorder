# 14c3c2a — Shared arbitrary-frame controller and package backend

Status: implemented; verification and scope are recorded in
[public package frame evidence](../assets/portable-inspection/public-package-frames.md).
Audio remains the next pass under 14c3c2.

## One orchestration owner

A shared FrameInspection controller owns option validation, one-time revision
pinning, annotation dependency readiness, batch assembly and explicit retry.
LibraryFrameInspection owns library queue/publication/cache policy. The package
backend resolves only an issued registry handle and its validated retained history,
then submits frame work to that same registry's queue-issued context. Default
revision remains the exported pin; an explicit included historical revision is
permitted for arbitrary frames. Embedded recording identity is provenance only.

Both backends execute the same materializeFrame and source/trail owners through
one output lifetime contract. Library outputs publish through DerivedCache;
package outputs retain the existing descriptor-backed RetainedPackage reservation,
native calls and read leases. No fake catalog rows, second decoder or scheduler.
Normalized source metadata/rows are read through the shared portable evidence owner.
Clean requests bypass annotation evidence. The existing frame.get/retry/batch
operations accept exactly one recordingId or packageHandle, and the common
CLI/MCP image transport consumes the resulting typed delivery.

## Continued progress

The existing queue remains the only job metadata owner. Its bounded context-job
snapshot lets the adapter forget drained terminal frame jobs when new admissions
need space; active/draining attempts are never forgotten. Requesting the same
immutable input reuses its available result. If the output was reclaimed, the
request admits a new job/attempt rather than reviving an expired result identity.

RetainedPackage remains the derivative-byte owner. Under its existing output/byte
limits, it reclaims least-recently-read, unleased ready outputs through its existing
serialized native cleanup. Held delivery reads are skipped, never awaited while a
frame slot is occupied. Fully pinned space returns a retryable limit; callers can
release deliveries then explicitly retry. Failed cleanup retains charge and can
be retried; unknown-identity creation failures still require context cleanup.
Close fences requests, drains context work and revokes package deliveries before
its existing descriptor-owned cleanup.

## Verification

Preserve library frame tests and generated library/native parity. Through a real
admitted relocated ZIP, request clean and annotated frames outside its retained
index, crops, cuts, pauses and an included historical revision. Compare image
bytes and timing/pointing metadata against the shared library materializer.
Verify repeat reuse, explicit retry, more than 32 sequential requests, output
pressure and regeneration, held reads, failed-cleanup accounting, two same-content
handles, same-ID library deletion, and close during actual native work. No devices,
ASR invention, or claim that arbitrary public audio is already implemented.
