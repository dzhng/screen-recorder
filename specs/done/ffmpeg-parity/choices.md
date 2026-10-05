# Implementation choices

This ledger records the lasting decisions made while implementing the authorized
parity plan. It is organized by verdict, then by confidence that the user would
have chosen the same behavior. All retained choices are sound; no unresolved
user-only decision or known unsound design remains in this ledger. Confidence is
about the decision, not a claim of universal media quality or release acceptance.

Review these first: the narrow HDR interpretation policy, the fixed thirty-second
optional speaker workflow, and the frozen dynamics recipes. They limit what an
agent can promise even when FFmpeg or a model can process a wider input.

Internal naming, fixture selection, reversible presentation styling and other
delegated discretion are omitted. Superseded research adapters, abandoned speech
families and intermediate acceptance narration do not constrain this release.
The owning code and retained receipts establish the implementation and proof.

## Sound choices — medium confidence

### HDR conversion uses one explicit display policy and refuses unfamiliar interpretations

When: slices 18–19. An agent explicitly requests HDR-to-SDR conversion. The tool
accepts only qualified ten-bit HEVC PQ/HLG input, uses the frozen Hable display
transform with its stated reference brightness, and produces a ProRes SDR
intermediate that ordinary placement can reuse. PQ and HLG are HDR transfer
functions; the transform decides how their brightness becomes an SDR picture.
A file carrying unfamiliar compressed metadata, dynamic interpretation, alpha or
contradictory declarations refuses, even if a general decoder opens it. The
unbuilt alternative would guess how that extra interpretation affects the picture.
Gap: the plan did not choose the exact display policy or safe interpretation set.
Reach: recipe changes need a new identity; broad phone-HDR support, HDR export and
range/acquisition conversion are not implied by this whole-stream operation.
Verdict: sound; an explicit limited treatment is preferable to an unproved one.
Confidence: medium.

### Optional speaker observations preserve one accepted local recipe and bounded input

When: speaker integration. A caller explicitly prepares verified local model and
runtime files, then selects one complete thirty-second source channel/window.
The optional worker runs the accepted original recipe; it does not download a
replacement, mix channels, fill missing source support or infer an edit. Its
bounded mono PCM input is assembled in memory before exclusive publication.
Unfamiliar decoder trimming refuses instead of guessing which emitted samples
belong to the source. The alternative would widen lengths or decoder behavior
from a single successful model run.
Gap: the plan did not settle the smallest supported local execution contract.
Reach: longer or arbitrary-window support requires a new qualification; this is
an evidence primitive, not a general diarization-quality guarantee.
Verdict: sound; preserves the known recipe and source meaning without another installer.
Confidence: medium.

### Mixed audio processing follows one compiled schedule and retains one final signal

When: shared audio preparation and slices 13–15. A requested processor stack can
alternate native effects and FFmpeg effects. Composition declares the connected
state domains—the complete spans needed for a processor's history—and detector
dependencies. Native renders each exclusive prefix; the service executes only
the selected external recipe; Core retains the final signal for inspection,
preview, export and packages. A short excerpt crops that same processed result.
The alternative would restart a processor at the excerpt or interpret the edit
graph again in the service, producing a different sound.
Gap: the plan did not specify how mature external filters join native state.
Reach: later effects must use the existing schedule, preparation and publication
owners; a missing prepared span refuses rather than selecting another recipe.
Verdict: sound; treatment meaning has one owner across every consumer.
Confidence: medium.

### Normalization publishes only a measured candidate that meets the requested targets

When: slice 13. A caller requests loudness, peak and, for dynamic mode, a maximum
loudness range. The implementation measures the complete selected signal before
and after the frozen treatment. If the requested targets are impossible or the
candidate misses the stated meter tolerances, publication refuses. Gain-only
mode never changes to dynamic mode on its own. The alternative would report
success merely because the filter process finished.
Gap: mature-filter completion did not define target-compliance failure.
Reach: peak tolerances remain scoped measurement allowances; final lossy encoded
output is not certified by measuring the pre-encoding signal.
Verdict: sound; a requested result remains a postcondition, not a suggestion.
Confidence: medium.

### Stereo limiting applies one gain envelope to both channels

When: slice 14. A loud peak in the right channel must not move the stereo balance.
The recipe forms a mono detector from the greatest absolute channel value,
limits that detector, and applies its gain to both signed program channels.
Zero detector samples stay zero. Automatic level compensation is disabled; the
mature filter's coupled attack/release behavior remains part of the frozen recipe.
The alternative's final per-channel clipping could meet a ceiling while changing
channel balance.
Gap: the plan required channel linking but did not choose the filter composition.
Reach: later limiter changes must preserve linking, timing and the original ceiling
contract rather than weaken a gate to admit a new candidate.
Verdict: sound; one shared gain fixes the failed property in general.
Confidence: medium.

### Sidechain processing makes packet endings explicit without adding source support

When: slice 15. A compressor receives program audio and a separate detector.
Some two-input filter packet shapes lose a partial final block. Both inputs use
one fixed padded sample grid, then the result is trimmed to the exact authored
sample count. Padding supplies processing context; it never becomes newly
available timeline media. The alternative would let upstream packet size decide
whether the final sound survives.
Gap: the plan did not choose deterministic end-of-input packetization.
Reach: detector/program clocks and complete state remain aligned for future recipes.
Verdict: sound; a frozen packet rule preserves the requested sample support.
Confidence: medium.

### SDR correction is an explicit source-neutral native treatment

When: slices 16–17. A caller requests modest SDR correction. Native Core Image
executes the selected controls with defined parameter meanings; it does not
pretend to infer camera white balance or silently replace them with similarly
named FFmpeg filters. The native provider and OS recipe identity participate in
render/preparation identity. The alternative would reuse control names despite
different numerical meanings.
Gap: the plan did not choose the native semantics or provider identity.
Reach: changed OS/provider behavior cannot borrow a previous prepared result;
new correction families need their own explicit recipe.
Verdict: sound; preserves native defaults and makes treatment meaning inspectable.
Confidence: medium.

## Sound choices — high confidence

### Native facts own timing; probe and packet facts supplement them

When: source authority and HDR integration. Two movies can have the same duration
and frame count while one interior frame occurs at a different time. The native
sample cursor fingerprints every exact presented timestamp/duration and retains
origin separately. Audio qualification counts actual decoded native-rate sample
cells and hashes PCM; compressed packet capacity cannot stand in for emitted
sound. FFprobe binds execution selectors and color declarations to the same held
bytes, but does not invent clocks from average frame rate. The alternative would
accept endpoint-only equivalence or packet padding as audible media.
Gap: the plan did not choose compact complete timing and decoded-audio evidence.
Reach: conversions and later readers must preserve exact support, origin and
interior timing; declared container padding remains separately visible.
Verdict: sound; one physical-facts owner prevents plausible but false timing claims.
Confidence: high.

### Source authority applies before metadata, decoding and external execution

When: slice 04 and ordinary admission. A source pathname may be replaced after
selection, or a container may refer to another file. Work retains the admitted
file descriptor, proves self-contained byte authority, and uses explicit selected
streams. Each external invocation gets a read lease rewound to zero; FFprobe's
cursor cannot make the next FFmpeg call see an empty file. Unselected native
track formatting does not reject a specifically selected speaker channel.
The alternative would reopen the donor path or let secondary resources change
what the admitted asset means.
Gap: held-byte selection, cursor handling and ordinary-probe authority were unspecified.
Reach: all media families share this source rule rather than container-specific workarounds.
Verdict: sound; the same immutable bytes govern inspection and execution.
Confidence: high.

### External output shares held allocation, validation and process lifetime owners

When: slices 03–05. FFmpeg needs a seekable file. The existing native new-file
primitive creates one exclusive leaf in the held attempt directory and hands it
to the child through a reserved descriptor. After the whole process group retires,
the file is reopened readonly with the allocated identity, hashed and validated
by the recipe. Native validators inherit the same attempt locks before the
consumer stages a copy. Exit zero alone is not completion evidence. The
alternative would write to a mutable absolute path or release work while a child
or validator still used its files.
Gap: Node lacks held-directory child allocation and the plan left validator access open.
Reach: every external producer supplies domain validation while reusing existing
attempt, cleanup, queue and publication ownership.
Verdict: sound; allocation, meaning and retirement remain distinct guarantees.
Confidence: high.

### A render attempt initializes its own private parent on first use

When: whole-feature review closeout. A fresh library adopts a portable asset
without performing an ordinary import. HDR conversion or speaker preparation
still needs a private render directory. The shared render-attempt owner creates
its missing parent before the usual privacy, identity and lock checks; existing
unsafe directories still refuse. Startup cleanup skips an absent parent. The
alternative would require an unrelated import merely to initialize storage or
repeat directory creation in every producer.
Gap: first-use parent initialization had been incidental to ordinary probing.
Reach: new producers can reuse the same attempt owner without hidden setup;
initialization never repairs permissions or bypasses held-directory admission.
Verdict: sound; the lifetime owner also owns its storage prerequisite.
Confidence: high.

### Tool dependencies have one reproducible owner and signed-byte receipts

When: slices 01–02 and color dependency integration. The pinned LGPL-compatible
FFmpeg owner builds replaceable shared libraries, tools and redistribution inputs.
Packaging copies the prepared distribution, signs that private copy and records
the signed bytes; it never rewrites the prepared source distribution or uses its
unsigned hashes to describe the signed app. Discovery checks bounded regular
resources and tool version/configuration through the existing process owner.
The alternative would create a second installer or publish hashes for bytes that
signing subsequently changed.
Gap: dependency layout, signing order and runtime verification bounds were unspecified.
Reach: consumers need no separate FFmpeg installation; additional dependencies
must join this build/receipt owner and preserve its licensing configuration.
Verdict: sound; reproducibility and actual installed identity describe the same tools.
Confidence: high.

### Direct media extras retain the selected installation's replacement lock

When: direct-tool integration. An agent requests a GIF or other non-core format.
After readiness/version checks, `screenrec ffmpeg` or `screenrec ffprobe` forwards
literal arguments and raw standard streams to the selected bundled tool while
retaining installation exclusion until exit. It starts neither Node nor the
service. An older external launcher is explicitly refreshed from a verified kit,
with backup and same-directory staging. The alternative would run an unprotected
raw executable path while an update replaced its app.
Gap: direct CLI fallback and launcher/update lifetime were unspecified.
Reach: extra outputs remain standalone artifacts, never hidden replacements for
a failed managed export; format-specific timing still needs actual verification.
Verdict: sound; one simple passthrough preserves the existing update lock.
Confidence: high.

### Managed conversion replays the original frozen request before checking readiness

When: slice 19 closeout. A conversion is admitted, then its tools disappear or its
app moves. A canonical business-request key finds the original frozen job/result
in existing job/artifact rows before execution prerequisites are checked.
Implementation hashes identify that frozen recipe; freshly verified paths merely
locate those bytes. Concurrent admissions recheck the saved key after verification.
A retry refuses different hashes. The alternative would lose saved output when a
tool was missing or create a new job because an identical binary moved.
Gap: conversion replay and runtime locator identity were unspecified.
Reach: no new request store or publication owner; later recipes need distinct
semantic identities instead of silently substituting implementations.
Verdict: sound; recovery and new execution have separate prerequisites.
Confidence: high.

### HDR derivatives retain the original and one exact selected common clock

When: slice 19. Video starts fifty milliseconds after selected audio. Conversion
uses the earliest selected occupied time as one derivative zero and chooses an
exact representable MOV clock; it never zeroes the streams independently. Only
explicit audio is codec-copied, then actual decoded PCM, layout, count and support
are compared. The immutable derivative retains its source dependency, fresh-fact
digests, unretimed media operands and implementation receipt. Portable adoption
binds those facts to retained source/output metadata. The alternative would add
silence, lose the offset or publish provenance that outlived its original bytes.
Gap: combined video/audio clock and portable conversion evidence were unspecified.
Reach: shortened occupied segments or stale deduplicated metadata refuse;
full-file conversion with narrowed range provenance remains unsupported.
Verdict: sound; preserved sound and source support are independently established.
Confidence: high.

### Measurements retain the selected signal and report missing measurement honestly

When: slice 10. The requested audio is quiet enough that no integrated-loudness
gate opens. The existing acoustic owner retains the selected PCM generation,
recipe, exact window and coverage, reports integrated loudness as unmeasurable,
and keeps separately measurable peaks. It does not turn missing media into
silence or infer a treatment. The alternative would publish a plausible LUFS
number or normalize automatically.
Gap: cache/report identity and empty-gate semantics were unspecified.
Reach: prepared signal pins survive context expansion and retries; an excerpt
measurement cannot claim complete-program or perceptual quality.
Verdict: sound; measurement scope remains evidence rather than editing authority.
Confidence: high.

### Output settings preserve format-specific meaning and actual readiness

When: slice 25. An agent chooses HEVC instead of H.264 for MP4. Common controls
remain shared, but H.264-only entropy/profile/level settings cannot leak into a
HEVC request. Capability discovery describes the selected native encoder's real
controls and AAC formats; explicit null uses an advertised encoder default.
Unavailable execution refuses. The alternative would silently substitute a codec
or apply a parameter with a different meaning.
Gap: HEVC control representation and encoder-default selection were unspecified.
Reach: the same resolved settings govern authoring, inspection and delivery;
HEVC does not imply HDR or transparent final output.
Verdict: sound; one discriminated settings contract avoids parallel allowlists.
Confidence: high.

### Transparent motion uses one immutable finite movie

When: slices 20–21. An external tool authors a finite ProRes 4444 MOV with actual
alpha and explicit SDR color. Ordinary admission and placement preserve its
moving asymmetric content, rotation and mirroring, with one byte identity and
native sample support. The alternative frame sequence would need member hashes,
missing-frame policy and another cadence manifest without a demonstrated need.
Gap: the plan left alpha interchange representation to feasibility.
Reach: normal retention/packages own this input; ProRes/alpha input does not add
ProRes or transparent final movie delivery.
Verdict: sound; the representation fits existing asset and clock owners.
Confidence: high.

### Caller helpers retain exact evidence without becoming product queues

When: slices 06–09. A batch import times out after its request may have committed.
The helper saves the intended call before sending, retains that item's admission
slot, and resumes its same identity before admitting more work. Compact transcript
pages shrink to the caller's budget instead of hiding a remainder. Timeline and
review artifacts preserve exact pins, sampled coverage, skipped work and actual
continuations. The caller supplies review extent; the helper does not reinterpret
the edit graph to invent it. The alternative would over-admit work or label an
empty/partial panel as complete evidence.
Gap: helper recovery, aggregate budgets and review extent were unspecified.
Reach: task manifests remain caller-owned; shared jobs, words, cuts and source
mapping retain their existing owners. Equal document or cut hashes do not certify
picture/sound equality.
Verdict: sound; bounded orchestration preserves missing work instead of hiding it.
Confidence: high.

### Caption drafts preserve words and source anchors without claiming font fit

When: slice 11. A selected word survives in separated project fragments, or only
at an instant. The pure helper retains raw pins and fragments, separates different
occurrences/segments, reports partial/discontinuous support, and leaves an instant
unplaced rather than inventing cue duration. Caller corrections change display
text only; meaningful separators survive wrapping. Grapheme counts—visible text
units such as one combined emoji—are not measured glyph widths, so native fit stays
unverified. Oversized boxes or output budgets report violations/refuse rather than
shrink, discard words or apply edits automatically.
Gap: grouping, fragmented dwell, correction and layout-failure semantics were unspecified.
Reach: existing text placement/fonts/rendering own application and final fit;
new measured proposals need their own admitted-font contract.
Verdict: sound; a portable draft remains evidence the agent can review and apply.
Confidence: high.

### Caption sidecars retain literal text and explicit format limitations

When: slice 12. Chosen caption text cannot be safely represented in SRT, or exact
fractional timing must become the format's coarser timestamps. Export freezes the
revision's displayed placements/text and records rounding, overlaps and omissions.
Unsafe SRT refuses; VTT can be explicitly selected rather than stripping chosen
characters. The alternative would change wording or cue support to make a writer
succeed.
Gap: sidecar representability and publication identity were unspecified.
Reach: the existing export intent/publication owner retains retries; exporting
captions neither runs speech inference nor chooses which captions to keep.
Verdict: sound; delivery preserves authored meaning and exposes format loss.
Confidence: high.

### Transferred task notes remain historical caller evidence

When: slice 24. Notes from an earlier revision mention an acquisition, stream,
occurrence, job or export. The helper keeps each owner's actual independent
anchors and verbatim receipts, including explicit absence; it does not retarget
notes to the current revision or invent a common render identifier. Referenced
artifact files remain task-side transfers, not managed product assets. Bounded
readers open nonblocking and check the same descriptor is a regular file, so a
named pipe cannot stall before admission. The alternative would rewrite history
or introduce another notes catalog into project state.
Gap: heterogeneous receipt anchors and transfer/file-admission semantics were unspecified.
Reach: resumption preserves context without granting new edits or replacing
project/package ownership.
Verdict: sound; caller knowledge and product truth stay separate.
Confidence: high.

### Optional Python assembly preserves the original runtime's startup and bytes

When: optional runtime and speaker integration. A caller supplies verified local
Python/model inputs. Assembly preserves the primary interpreter's startup behavior,
ordered package layers and original loader links; only named thin-arm64 loader
search metadata edits are allowed. Developer-only metadata is excluded from the
execution closure. The verified model descriptor is compressed into the existing
service bundle; it does not register another preparation or inference owner.
The alternative would flatten dependencies, rewrite arbitrary donor libraries or
fetch an unselected runtime at execution time.
Gap: relocatable local dependency layering and descriptor distribution were unspecified.
Reach: future optional runtimes must retain explicit identities and use the existing
purpose-checked model preparation accessor.
Verdict: sound; known runtime behavior survives relocation without a second installer.
Confidence: high.

### Speaker evidence retains native truth while reads use chronological order

When: source/project speaker integration. Two anonymous slots have simultaneous
observations, and native rows arrive in an order unsuitable for pagination.
The store retains every original row ordinal, raw operand and uncalibrated score
cell; a separate chronological sequence serves seeking and project merging.
Slots identify no person outside their generation. Retained reads bind the original
decoder and observation even if current executables/models are absent. Refused
observations preserve lossless native diagnostics but never become published
success. The alternative would rewrite row identity, compare scores as confidence,
or rerun a model merely to read old evidence.
Gap: retained reads, ordering and refusal evidence semantics were unspecified.
Reach: project mapping preserves simultaneous observations and exact source
identity; display crops do not rewrite complete source observations.
Verdict: sound; read convenience does not alter model evidence.
Confidence: high.

### Portable speaker evidence is a typed resource and incompatible formats refuse

When: speaker portable integration and HDR origin integration. A project package
contains retained speaker observations and converted source media. Package format 4
carries a typed speaker resource with original raw bytes, scores and published
chronological sequence; dependencies keep its source reachable. Adoption validates
against the recorded bound recipe rather than silently using today's decoder or
rewriting old evidence. Catalog 26 and package format 4 explicitly refuse older
writers/formats that cannot preserve this meaning. The alternative would silently
omit evidence or pretend incompatible state had been reconstructed.
Gap: portable resource meaning and old-format disposition were unspecified.
Reach: future portable additions need one semantic owner and explicit compatibility;
there is no automatic migration or deletion of personal state.
Verdict: sound; copied bytes and their meaning travel together.
Confidence: high.

### Darwin process creation preserves inherited descriptor bookkeeping

When: worker integration. The bundled Node/libuv runtime can corrupt parent file
descriptor bookkeeping when launching Darwin children with inherited files.
The common worker retains the same real/effective user ID to select the safe fork
path for ordinary non-root accounts. Authority, groups and retirement stay unchanged.
The alternative would reduce input cases or add another child-process launcher.
Gap: the runtime/platform defect was outside the original process contract.
Reach: this is one documented process-owner workaround, removed only after a
supported bundled runtime fixes the behavior; it makes no changed-identity/root claim.
Verdict: sound; corrects the shared platform cause rather than a media-specific symptom.
Confidence: high.

### Release and consumer evidence preserve complete observations and scope

When: consumer/release integration. A relocated bundle is checked with the same
small public delivery observer as scratch execution, under an isolated environment.
The production app/updater and a person's preferences are not launched for this
proof. Portable agent trials separately check skill/schema behavior; repeated
complete strings share a dictionary rather than being truncated to fit a judge.
The alternative would mistake archive launch for media delivery, a portable trial
for native readiness, or a clipped transcript for a passing evaluation.
Gap: proof reuse, environment isolation and bounded judge representation were unspecified.
Reach: root owns final bundled acceptance/full-suite disposition; absent production
credentials leave publishing to CI, not a hidden local signing substitution.
Verdict: sound; each observation supports only the boundary actually exercised.
Confidence: high.
