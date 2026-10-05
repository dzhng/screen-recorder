# 96 — Declared audio domains and held prepared spans

Status: complete; compiler/native/service execution and rebuilt-root acceptance
verified. Final packaged execution belongs to26. Question: **Can one compiled state
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

## Execution checkpoint

The native held-span/prefix contract, typed service dependency walk, shared
composition transport and reuse of one render-attempt artifact authority are
implemented. Real bundled proof covers signed asymmetric stereo, missing and
mismatched held operands, full-domain late crops, shared split continuity,
RNNoise→limiter→RNNoise, a declared silent external detector, both normalization
modes, infeasible gain, unmeasurable silence and the frozen stepped LRA refusal.
Core requires complete bound processing evidence and normalization postconditions
at publication and portable adoption. Prepared excerpt reads preserve the
original whole-domain measurements. No playback or sound-quality claim is made.

Each completed external domain holds one service fd; native inherits and
duplicates it for bounded positional reads. All recipe outputs share the outer
attempt's two directory leases, with temporary prefixes retired before downstream
work. The observed soft limit is 1,048,575 and the existing compiler bounds domains
at 20,000; this proves the measured single-job fixture path only, not a global
concurrency guarantee. Resource exhaustion must fail cleanly under existing
worker/artifact/job owners; no nominal 128-domain policy is introduced.

Production13–15 are wired to actual bundled/native preparation capability.
Public socket proof now covers import, explicit normalization→limiter→compressor,
pinned full preparation and a retained late excerpt. A restart with a distinct
verified tool receipt produces a different unprepared cache job; removing the
renderer binding reproduced cache reuse red. Native movie consumption is verified.
The independent execution reviews found the runtime/cache binding, empty
domains, a stale harness expectation and portable evidence being checked against
unbound requirements. All were reproduced or verified and corrected. The public
processed-package export/open/adopt journey now preserves all three processor
records under adopted identities and survives package closure. Native also refuses a replaced preparation implementation before prefix
work. Wider refusal/retiming coverage is retained below; release-level consumer proof
and final consumer/release acceptance26 remain open.
The parent owns integration and the final full-suite run.

## Main reconciliation checkpoint

The execution checkpoint is reconciled with main's update-admission/job lifetime
and the native retained source/HDR inspection changes through `c1168c1a`.
Composition, protocol, core, client, service and the linked native worker rebuild;
service/core type checking passes. The scoped run passes three native held-audio
contracts, 38 core publication/prepared-audio checks (one existing opt-in skipped)
and 42 service checks, including all nine actual bundled recipe/public-package
cases and the updater lifetime file. Source authority and HDR inspection remain
unchanged from that main checkpoint; the corrected reproduction operand archive
is preserved.

The updater check exposed an observation race: a public response can arrive while
its accepted socket is still retiring. The test follows progress-driven preparation
retries and admits only the transport blocker during that drain; the product gate
is unchanged. This is scoped integration evidence, not an installed consumer or
full-suite result. Release-level acceptance remains with the parent task.

## Wider audio acceptance checkpoint

The [scoped receipts and complete codec operands](../evidence/audio-state-acceptance/receipt.json)
retain the execution and resource facts. Whole-domain source holes refuse limiter,
gain-only normalization and an external compressor detector even when the requested
late crop does not overlap the hole. Authored detector silence remains distinct
from missing support. Both normalization modes followed by limiter and compressor
preserve repeated retimed selections: the 24-second full output, midpoint splits,
late crop and repeated halves compare within the frozen1e-6 PCM tolerance, with
exact1,152,000 frames and six bound whole-domain records. Original input stays intact.

An explicit normalization→active limiter fixture prepares384,000 frames at a
−6.0dB sample/true peak under the retained meter. Native H.264/AAC delivery decodes
to the same count but measures−5.8dB sample/true peak. These are separate retained
facts, not an encoded ceiling guarantee or a listening claim. Normalization's
before/after record covers its own stage; a later explicitly requested limiter
changes final integrated loudness, as the separate prepared measurement shows.

Actual public preparation under a disposable child's64-file soft limit fails
retryably with CoreAudio−42, returns no prepared result, drains the shared attempt
workspace and retains original source bytes. The listener remains usable and a
new explicitly simplified revision prepares successfully under that same limit.
The same80-domain fixture succeeds under a256-file limit and supplies all80 held
operands to the final consumer. No host/account-wide limit or admission cap changes.
The failure point is a host/fixture observation, not a promised domain budget.

This wider test exposed bundled Node24.21.0/libuv1.52.1's Darwin descriptor-remap
bookkeeping defect. The shared process owner selects the runtime's safe fork path
for inherited files under ordinary non-root accounts with matching real/effective
IDs. A focused regression was observed red on the original owner and green after
the correction, proving reversed operand bytes, preserved parent reads, identical
account/groups and retirement. [The upstream fix](https://github.com/libuv/libuv/pull/5284)
was merged but was absent from the supported bundled LTS when checked. Root or
changed-identity accounts retain existing behavior; this adds no guarantee for them.
The service README owns the workaround and its fixed-LTS removal condition.

The latest-main merge through55b6957c preserves these edits; worker, CLI/group,
artifact and update-lifetime checks are rerun after reconciliation. Captured native
media proof uses the hashed lane binary; this does not certify a signed installed
release or the latest capture identity changes. Those checks and the final full
suite remain with the parent task. No recording, inference or playback was run.

The independent uncommitted review reports no actionable defects; its worker/CLI
checks and service typecheck passed. Its native reruns encountered sandbox socket
and decoder restrictions, with the existing limiter and no-descriptor source
control also failing decoding. The compressed review log preserves these limits
separately from the successful unsandboxed acceptance receipts. The shape/diff/docs
pass retains one shared worker owner and the explicit fixed-LTS removal condition;
no new execution surface or media policy was added.

The [root integration receipt](../evidence/audio-state-acceptance/root-integration.json)
rebuilds the actual worker after release0.1.4 app-identity reconciliation and passes
all four new real acceptance cases plus50 worker/CLI/artifact/update checks.
Identical source, prepared and decoded PCM bytes reuse the original retained
archive; the distinct encoded movie and root receipts are retained separately.
This closes the wider root integration gap, while installed/signed acceptance,
listening and the final full suite remain separate. The scoped tool proof closes
shared preparation and13–15; consumer/release acceptance26 owns the final package
check once. The user evaluates practical sound quality through product use.
