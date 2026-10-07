# 01 — observed face trajectories

## Contract

Add a generation-pinned read over retained face observations. The result is a
trajectory whose samples say `observed`, `predicted`, `gap`, or `ambiguous` and
retain source clock, implementation/domain identity, source observation IDs, and
quality metadata. Existing single-frame `faceObservations` remains the native
measurement contract.

Prediction is opt-in and must be labeled as prediction. The initial accepted
slice may ship observed/gap/ambiguous rows and a refusal receipt for the existing
Vision tracker hypothesis; it must not silently smooth or synthesize boxes.

## Ownership and seam

Extend `packages/core/src/face-tracking.ts` and the protocol schema/operation
owner. Reuse the existing source/index generation and package read machinery.
The service handler is shared by CLI and MCP. Do not create a second tracking
algorithm or alter the native detector contract.

## Verification

Add focused protocol/core/service tests and an inference-free replay under
`packages/test-harness/editing/face-trajectory-replay.*`. Bind source hashes,
clock ordinals, detector implementation, reset reasons, exact boxes, and the
27-frame full-face refusal. Mutation of any bound field must refuse.

## Must stay green

Existing face tracking tests, source/project frame tests, full-face refusal replay,
type checks, and CLI/MCP operation-schema tests.
