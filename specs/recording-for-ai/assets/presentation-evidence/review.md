# Presentation evidence review

The movie reader and evidence writer use the same sequential presentation-support
owner. A retained moment inside a sparse sample displays that sample even when a
public still request would choose a closer future timestamp. The evidence stream
preserves this difference and marks proven empty edits explicitly; it never
pretends an unexplained support gap is a held picture.

## Evidence

The [native worker fixture](../../../../helpers/mac/Tests/video-render.test.mjs)
verifies that the same sparse source selects source zero for movie support at
0.75 seconds while public still inspection continues selecting source one second.
The existing renderer pixel/color/timing tests run alongside the evidence tests.
The [lifetime fixture](../../../../helpers/mac/Tests/ScreenRecorderFrameTests/PresentationEvidenceTests.swift)
cancels actual work after staging bytes appear, then checks cleanup; another run
creates an unrelated destination during work and proves it is preserved.

[Results](results.json) record the scoped native run. Increasing streamed output
fiftyfold from roughly 0.94 MB to 47.32 MB increased peak native resident memory by
roughly 6.5 MB in the initial run. Both runs stream records rather than returning
all evidence through the worker pipe. The test has an explicit memory allowance,
not a claim that total native memory is independent of source metadata.

Independent Codex review found a verification-directory symlink pointing to
another checkout's compiled timeline module. The symlink was removed and the core
was built locally before the final native run. Its native rerun was blocked by
sandbox encoder access; this report's successful runs used the isolated build
outside that sandbox. Shape, diff and documentation review found no remaining
production issue.

## Boundaries and next consumer

This is clean presentation evidence, not movie pointer readiness. Stream records
carry exact rational support boundaries. A selected sample timestamp can precede
a retained cut start because its supported picture is still displayed there.
The still sampler's `actualSourceUs`-inside-kept validation therefore cannot be
reused unchanged for movie evidence. The next core adapter must establish exact
support membership without weakening still selection or duplicating cursor
eligibility policy.

Explicit empty records have no selected image; a future pointer policy must handle
that state explicitly. The producer neither draws pointers nor chooses scenes.
Cancellation inside the process removes staging. Hard process termination still
requires the existing service attempt owner to reclaim its private directory;
no public preview/export or service-death cleanup gate is claimed here.

[Main-checkout verification](merged-verification.json) records the native binary
and passing full FrameTests plus seventeen worker regressions after integration.
