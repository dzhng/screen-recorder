# 96 — Declared audio domains and held prepared spans

Status: compiler checkpoint verified; native/service execution remains open. Question: **Can one compiled state
schedule carry native and FFmpeg processors through the same prepared signal?**

Dependencies: [05](05-managed-output.md), [10](10-loudness.md), and the frozen
[normalization](13a-normalization-reproduction.md),
[limiter](14a-limiter-reproduction.md) and
[compressor](15a-compressor-reproduction.md) recipes. Production 13–15 depend on
this seam. The parent accepted this direction before behavior changes.

## Owners and typed contract

Extend `StatePlan` in composition's processing-state owner: each complete domain
retains its processor recipe, implementation identity, exact range/sample range,
ordered members and dependencies. Members identify target and exclusive-prefix
step. Stateful eligibility and shared continuity belong to the processor registry,
so split preservation and state derivation do not carry separate lists of filter
names. Keep native RNNoise parameters and state semantics unchanged. The frozen
normalization/limiter/compressor schema fields are authoritative; arbitrary filter
strings, argv or provider fallback are not authoring data.

A compressor domain additionally declares each member's resolved audio detector
endpoint and the exact same sample clock/range. The processing planner resolves
mixed-media tap ordering before filtering video steps. A self-clip tap becomes
an internal member-relative recipe; structural split remaps its explicit public
clip/step references and retains the single full domain. An externally referenced
detector clip refuses partitioning until the caller explicitly selects a stable
track/group tap or removes the dependent processor, including in an ordered batch.
No lineage alias or new public tap representation is introduced. A wholly disjoint
clip detector follows the existing clip-tap no-samples refusal; empty track/group
detectors remain explicit zero-capable nodes without extending parent program
support. Bypassed compressors add no detector dependency. `input` names the program prefix; a processing tap names
its explicit target/point prefix. The compiler derives all program and detector
upstream dependencies, refuses cycles and selects complete state domains for an
excerpt. Authored detector silence remains zero PCM; missing source support is a
refusal. Routing and timeline projection never move into the service.

The internal native media contract renders a compiler-declared domain's exclusive
prefix WAV using the existing `Graph`, `Stream before:` and ordered member
schedule. The native operation selects a domain by its compiled index and validates
its recipe/membership against the plan; it does not accept an independently
interpreted timeline. Existing source-format, resampling-context and unavailable
support admission remain binding. Receipts retain domain/recipe identity and
exact stereo 48 kHz count/clock, with local file positions distinct from absolute
project sample positions.

The corresponding held prepared-span operand names domain index, bound recipe,
absolute domain sample range, validated WAV descriptor/identity/data offset and
frame count. Native checks every operand against that selected compiled domain
before `PreparedState` admits it. The existing owner maps each ordered member to
its domain file position and supplies that span at the named target/step. Missing,
stale, duplicate, wrong-count, wrong-clock or wrong-recipe operands cannot become
live processing or silence. The held descriptor and writer retirement contract
from05 applies throughout. File locations are ephemeral implementation details.

Native retains ownership of RNNoise preparation and graph scheduling, including
mixed RNNoise→FFmpeg→RNNoise stacks. A pure-native plan keeps its existing fast
path. Extend existing prepared storage/read semantics for held stereo operands;
do not add a second routing renderer, state cache or ad-hoc subprocess. Native
JSON media workers never spawn FFmpeg outside the owned CLI process lifetime.

The service walks only compiler-declared dependencies, requests native prefix
PCM, runs the one bound typed FFmpeg recipe through the existing managed artifact
owner, validates output clocks/count/coverage and admits normalization's measured
postconditions. A failed candidate stays unpublished. It supplies held validated
spans to the native graph, which owns target replacement and all downstream
processing. The service does not schedule clips, mix stems, infer silence, decode
routing or reconstruct time mappings. Mixed native prerequisites are executed by
native under the same declared dependency schedule; how their existing owner
reuses intermediate spans is delegated internal decomposition.

Core's existing `PreparedAudioStore` retains the complete final processed output.
Its job/prepared recipe binds the full processing plan plus native and FFmpeg
implementation identities. Inspection, preview, export and portable adoption use
that same result and their existing resource lifetime. No new public operation,
queue, cache, catalog, publication, project or provider owner is introduced.

## Small runnable acceptance

Write tests red before changing behavior. First expose typed compiler/native
contracts with tiny authored PCM and fixture identities; activate no production
processor until its owning slice earns execution capability. Then exercise one
public pinned preparation with the actual bundled runtime. Save complete matched
input/output operands before gates; the narrowest check owns each claim.

- Reordered/nested stacks: native prefix endpoints include upstream steps and
  exclude the selected step/downstream stack; expected signed PCM is independent.
- RNNoise→FFmpeg→RNNoise: native state owner supplies both prerequisites and
  downstream processing; no unknown processor or missing-span fallback occurs.
- Detector dependency cycles, including a tap that includes its own compressor,
  fail in composition before native/artifact execution.
- Native held-span admission refuses stale/missing/duplicate identities and wrong
  range/count/clock/recipe. Cancellation or worker replacement retires all writers
  and leases before consumption/publication.
- Full output versus an excerpt from the same complete state domain compares PCM
  under the frozen 1e-6 gates. Structural split/unsplit and repeated/retimed source
  selection retain compiler continuity and exact counts; no cold excerpt reset.
- Existing native RNNoise/gain/retime cases remain unchanged. Prepared identity
  distinguishes a changed recipe/runtime and retains an explicit selected result
  through inspection/preview/export and retry.

This seam proves scheduling, span admission and lifetime. Scalar treatment
postconditions and user-facing execution capability remain13–15. It makes no
sound-quality or encoded peak-compliance claim; no recording, playback or personal
media editing is needed. The parent owns the final full-suite run.

## Decision budget and next work

Delegated: internal symbols, wire operation naming, temporary-file layout and
bounded fixture selection. Fixed: one-owner architecture, exact clocks and
complete state domains, typed recipes, no fallback, binding held spans, unchanged
native recipes, detector-cycle refusal and no service timeline interpreter.

If an implementation requires another public contract or a new interpretation of
continuity, reslice before coding it. Materialize and verify this shared contract,
then implement13–15 against their already frozen numerical recipes. Retain every
failed candidate and distinguish measured admission from treatment execution.

## Compiler checkpoint

Registry-owned stateful eligibility, static recipes, split/detach continuity,
member-relative self detectors, resolved tap endpoints, cycle refusal and nested
batch-label resolution are implemented in composition. New behavior cases
were observed red before green (including bypass falsification); the focused
processing/state/edit run passed124tests and composition type checking. The
independent reviews found six detector gaps, all reproduced and corrected before
this checkpoint. Native/service execution, processor capabilities, public PCM
acceptance and production13–15 remain open.
