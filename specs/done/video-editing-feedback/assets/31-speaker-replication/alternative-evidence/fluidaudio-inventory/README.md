# Existing FluidAudio seam

The native helper already pins FluidAudio 0.15.7 at
`41540ea237350afe5117a082b5c28eda642d0612`. The Apache-2.0 source snapshot and
hash receipt here cover the offline owner and relevant registry contracts.
This is Community-1 powerset segmentation, WeSpeaker embedding, PLDA transform,
AHC warm-start and VBx whole-input clustering: a distinct mechanism from the
failed streaming Sortformer providers.

`OfflineDiarizerManager` publicly accepts mono16k arrays or a disk-backed source,
prepares inference once, and clusters a `PreparedDiarization` again without
repeating inference. Clustering uses one selected input's embeddings, so global
anonymous labels are inferred jointly rather than stitched across independent
calls. This supplies a plausible long-form continuity mechanism, not verified
continuity. Automatic count defaults to no count hints; constrained local
assignment defaults on. Segmentation has three local slots per ten-second
window; global clustering can produce more identities. Reconstruction retains
multiple simultaneous clusters when `exclusiveSegments=false`. Its default is
true and explicitly trims overlap, so the false setting must be frozen before
any required-overlap trial.

The current model registry points to ungated
`FluidInference/speaker-diarization-coreml`, revision
`df2625ac79a7ac6b65ad868fee6d80f320da4232`. The five supported required artifacts
are Segmentation.mlmodelc, FBank.mlmodelc, Embedding.mlmodelc, PldaRho.mlmodelc and
plda-parameters.json. Exact manifest and LFS hashes are in `tree.json` and the
upstream conversions in `provenance.json`. `NOTICE.md` and `LICENSE` scope
CC-BY-4.0, including commercial use, to these Community-1 conversions; legacy
models in the same repository do not inherit that confirmation. Preserve
pyannote, WeSpeaker, BUT Speech@FIT and Fluid Inference attribution, the license
link and modification indication. This inventory downloads metadata only.

Native model readiness must use existing Models preparation to acquire the
complete pinned byte closure, followed by network-denied loading. FluidAudio's
own `prepareModels` can download implicitly and its default cache must not
become another acquisition owner. Set ModelHub.offlineMode and provide explicit
local model instances or directory after preparation.

Public output includes speaker segments, database, timings and optional chunk
embeddings with cluster assignment when `exposeChunkEmbeddings=true`.
`SegmentationOutput` fields are public, but the prepared carrier's segmentation
and timedEmbeddings properties are internal, so they cannot be read by an
ordinary external caller. First public-output quality gates need no casual
upstream patch. If a quality winner requires exact model-logit replay, retain a
frozen reference-only extension compiled within an isolated copy of the upstream
module (including source hash), or establish an explicit upstream public
observation seam. A production workaround and unverified rawmodel completeness
are not accepted substitutes.
