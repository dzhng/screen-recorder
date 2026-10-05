# Implementation choices

The user authorized implementation on 2026-10-04 via /goal /implement-spec.
This ledger records decisions outside the frozen plan; delegated internal naming
and fixture selection are discretion, not new product decisions.

## Sound choices

### Stateful audio keeps one compiled schedule and one final retained signal

When: audio recipe integration. Native and FFmpeg processors can alternate in one
stack. Composition declares complete state domains and detector dependencies;
native renders each requested exclusive prefix and consumes validated held spans;
the service walks that dependency schedule and executes the selected filter recipe.
Core retains the final prepared mix for inspection, preview, export and packages.

Gap: the plan did not define how an external mature filter joins native state.
Reach: no service timeline interpreter, extra state cache or native ad-hoc child
process is introduced. Pure-native behavior stays on its existing path. A stale
or missing domain span refuses instead of quietly rerunning a different recipe.
Verdict: sound; the shared preparation slice must prove the mixed-stack contract
before any new processor advertises execution. Confidence: medium.

### Normalization publishes only measured target-compliant candidates

When: normalization reproduction. Dynamic normalization can hit integrated
loudness while missing its requested loudness-range maximum. Both gain-only and
explicit dynamic modes retain their requested targets and validate achieved
results under the predeclared meter-specific tolerances before publication.
Impossible or failed targets refuse; there is no automatic mode switch.

Gap: the plan named targets without defining failure after mature-filter execution.
Reach: a successful filter process is insufficient readiness. The requested LRA
remains a maximum, and the true-peak tolerance is a scoped measurement allowance,
not mathematical or encoded compliance. Final lossy delivery is measured separately.
Verdict: sound; mature implementation reuse cannot erase caller postconditions.
Confidence: medium.

### Linked limiting applies one mature gain envelope to both channels

When: limiter reproduction. The stock limiter's final per-channel safety clipping
can slightly disturb stereo balance near its ceiling. The selected recipe limits
one mono maximum-absolute-channel detector, then applies its gain to both signed
program channels. Zero detector samples stay zero. Low-level results preserve the
previous candidate exactly; the near-ceiling difference is intentional.

Gap: the plan specified channel linking without choosing the filter composition.
Reach: a single lookahead control describes the mature filter's coupled linear
attack. Automatic level compensation is disabled, while its bounded release-step
gain quirk remains explicit. Timing, sample ceiling and linking gates were preserved.
Verdict: sound; a shared envelope corrects the failed property without weaker gates.
Confidence: medium.

### Sidechain processing uses one input packet grid and exact output trim

When: compressor reproduction. A mature two-input filter drops a partial last
block for some packet shapes. Both program and detector are padded on one fixed
sample grid before processing, then the output is trimmed to its exact authored
count. Padding is filter context, never newly admitted timeline support.

Gap: the plan required tails and sample preservation without choosing packetization.
Reach: the compiled detector and program keep the same project clock and full
context. Unequal upstream packet sizes cannot define treatment semantics.
Verdict: sound; the frozen recipe makes EOF handling explicit and deterministic.
Confidence: high.

### Meter results reuse acoustic ownership and retain the selected signal

When: slice 10. Loudness is another read-only reduction of the exact PCM already
used for waveforms and spectra. Its report retains the meter recipe, selected
prepared resource, processing identity and whether the request covers the whole
signal or an excerpt. An empty integrated gate is reported as unavailable even
when sample peak remains measurable; omitted media cannot become silent samples.

Gap: the plan did not choose report/cache representation or empty-gate semantics.
Reach: existing acoustic jobs, retries and cache lifetime remain the owner. Explicit
prepared pins survive admission, context expansion and retry instead of being
resolved again against whatever preparation exists later. No measurement edits
the project or establishes perceptual sound quality.
Verdict: sound; identity and measurement share the existing PCM contract.
Confidence: high.

### Native timing fingerprints include every presented sample

When: slice 19 preparation. Two sources can have identical endpoints and sample
counts but different interior timing. The native cursor streams reduced rational
presentation-time/duration pairs into a fingerprint, normalizing uniform origin
translation while retaining the actual origin separately. Fresh color facts cover
all format descriptions and actual alpha; old cached metadata is not silently
upgraded or mistaken for source corruption.

Gap: the plan required exact conversion clocks without choosing a compact complete
timing proof. Reach: managed HDR admission must compare interior fingerprint and
exact endpoints/tail/origin, keeping padded container declarations separate.
FFprobe remains a codec/range supplement, never the timing authority.
Verdict: sound; one native physical-facts owner prevents endpoint-only equivalence.
Confidence: medium.

### Known model padding is separate from physical source support

When: speaker research. A provider emits a short tail beyond the recording after
its documented inference windows are zero-padded. A frozen adapter intersects only
that proven padded support with the physical source clock, preserving every
interior prediction and the raw invalid result. An unexplained outside interval
still refuses. The adjusted result can still fail the unchanged quality gate.

Gap: the research plan did not define an explicit padded-input clock adapter.
Reach: this is a provider-specific research mapping, not permission to clamp
arbitrary evidence or edit source timelines. Untouched confirmation remains
separate from development calibration; annotation rights do not grant audio rights.
Verdict: sound; declared model input support cannot masquerade as real recording.
Confidence: medium.

### Installed acceptance reuses the public delivery observer

When: release acceptance preparation. A package can launch successfully while its
actual CLI import or export fails. The relocated check now runs the same one-second
video plus authored stereo-marker fixture as the scratch public journey, using
the packaged CLI and discovered tools under the clean release environment. Both
routes share the expected codec, color, clock, audio-landmark and replay checks;
they keep separate caller lifetimes and complete reports. A second installed-only
oracle could silently weaken those requirements.

Gap: the plan required installed component acceptance without choosing how to
reuse the existing publication proof. Reach: tagged CI must fetch the small retained
corpus; every attempt keeps media/receipts in a new ignored release directory.
Wiring and a passing scratch route do not certify the final installed package.
Verdict: sound; one observer preserves the same public-delivery requirements.
Confidence: high.

### Judge evidence shares bytes without dropping execution history

When: consumer acceptance preparation. An agent reads the same large operation
catalog several times. The judge gets one complete copy of each identical output
and references from every command/CLI receipt, preserving all attempts and failures.
Raw runner artifacts remain unchanged. A prose planning answer alone cannot prove
the exact identifiers an edit would submit, so that trial requests a printed
task-side selection template and request skeletons for concrete inspection.

Gap: the acceptance plan left bounded judge-input and planning-artifact shape open.
Reach: no help schema, failed call or relevant media evidence is truncated to fit;
unique oversized evidence remains an infrastructure failure. Portable plans prove
schema/identity handling, not a native edit or professional perceptual quality.
Verdict: sound; separate evidence from summaries without hiding failed trials.
Confidence: medium.

### Transferred notes remain historical caller-owned evidence

When: slice 24. Another agent receives a small versioned notes file beside a
project package. It preserves chosen/rejected candidates, reasons and exact
owner receipts. The helper reads only project metadata and the pinned historical
revision, then reports whether the current head changed. It checks transferred
file presence without importing, preparing, remapping identities or applying edits.
A present file does not imply watched, listened or accepted content.

Gap: the plan required portable notes but left the task file/resumption shape open.
Reach: notes have their own version, independent of product package schemas;
there is no new catalog, revision format or mandatory transfer payload.
Verdict: sound; caller annotations remain separate from authoritative media state.
Confidence: high.

### Notes retain actual independent owner anchors and raw receipts

When: slice 24. A saved acquisition, source, job or export receipt can identify
its owner independently; an occurrence still requires project and pinned revision,
and a stream requires its asset. Nullable absent fields and an export's nested
snapshot remain verbatim. Inventing a render identifier or forcing every receipt
into one top-level revision shape would reject real product evidence.

Gap: the plan did not specify how heterogeneous artifact receipts are admitted.
Reach: future receipt families must use their authoritative identities; local
artifact keys connect annotations to transferred files but cannot invent owners.
Verdict: sound; validation follows actual contracts. Confidence: high.

### Bounded task files are opened without waiting for a producer

When: slice 24. A selected notes path could be a named pipe rather than a file.
The common bounded reader opens nonblocking, then checks the same descriptor is
a regular file within the byte limit. A normal blocking open stalled before that
check. Delivered timeline evidence now reuses this general reader, rather than
adding a second file-reader implementation.

Gap: expanding the existing delivered-file reader exposed an untested pipe case.
Reach: all explicit task file consumers share the regular-file and byte contract;
symlink containment checks for transferred artifact presence stay separate.
Verdict: sound; bounds apply before potentially unbounded reads. Confidence: high.


### Bottom-center layout in caller safe area

When: slice 11. Given
  a selected caption box and safe rectangle, the helper centers the unchanged box
  at the rectangle's bottom. It does not shrink text when the box is too large;
  it reports a violation. The plan did not choose placement within that rectangle.
  This makes a predictable ordinary draft without assuming a platform's margins;
  the caller can replace the geometry. Future automatic positioning remains
  outside this helper.
Verdict: sound. Confidence: medium.

### Envelope dwell and visible support diagnostics

When: slice 11. A word can survive in two separated project fragments. The proposal retains
  both, keeps that word separate and marks it discontinuous. Dwell is the enclosing
  time from first support to last support, not newly invented continuous speech.
  The alternative would extend/rewrite timing or silently hide gaps. The plan did
  not define fragmented reading time; future continuous-support metrics must use
  the retained fragments and keep this scope explicit.
Verdict: sound. Confidence: medium.

### Offline complete-entry input

When: slice 11. If an agent has only
  half a transcript page or source-only words, the helper reports missing evidence
  and drafts nothing. It never fetches/prepares speech on its own. The plan left
  acquisition unspecified; requiring one complete compact project entry preserves
  the existing read owner and makes this helper portable with no new runtime.
Verdict: sound. Confidence: high.

### Exact selected rows and literal corrections

When: slice 11. A
  caller may correct “hello” to “Hello” or explicitly display an empty string.
  Only selected rows change display; original source words/pins remain in evidence.
  Skipped rows split cues instead of sneaking unselected speech into an envelope.
  The plan allowed corrections but did not choose a request shape. Row indexes
  refer to one immutable pinned entry; no normalization or semantic rewrite occurs.
Verdict: sound. Confidence: high.

### One occurrence/segment per cue

When: slice 11. Repeating the same
  source take twice returns two separate source-anchored drafts. Different
  occurrence IDs, speech segments and fragmented/partial words split. The plan
  required exact pins but left grouping boundaries open. Mixing them into one
  content anchor would misrepresent authoring, so existing occurrence identity
  remains the anchor owner.
Verdict: sound. Confidence: high.

### Grapheme proposal and unverified native fit

When: slice 11. A
  combined accent or emoji counts as one grapheme, a user-visible text unit, but
  that count cannot predict glyph width in a selected font. The helper always
  retains an unverified-layout diagnostic. The fixture measures actual native
  layout only for its own explicitly applied Latin draft. No font service or
  speculative measurement API was added; future measured proposals need their
  own admitted-font contract.
Verdict: sound. Confidence: high.

### Reported bounds without loss

When: slice 11. For 1001 selected
  words that fit one textual line, the existing seed limit requires two cues;
  all pins survive and the split is reported. Excessive total output refuses
  instead of truncating. The plan left work bounds unspecified. Incremental line
  state avoids quadratic prefix layout; the current limits belong to helper code.
Verdict: sound. Confidence: high.

### Existing owners and no dependencies

When: slice 11. The helper
  reuses the consumer JSON/budget transport and returns existing clip/geometry
  drafts. The tiny proof reuses composition/native frame execution. The unbuilt
  alternative would add a caption service, queue or third-party text engine.
  None is necessary for pure caller-constrained proposals, so later application,
  persistence and exact rendering stay with their current owners.
Verdict: sound. Confidence: high.

### Instant words stay evidence without placement

When: slice 11. An ASR word may have a positive retained raw pin but project to a single instant.
  The helper now isolates and reports that observation with `clip: null` rather
  than failing surrounding ordinary words or inventing positive cue time. The
  plan did not explicitly cover point projections. This extends the draft result
  shape only for unplaceable evidence; callers must inspect violations and apply
  only placeable chosen drafts.
Verdict: sound. Confidence: high.

### Meaningful separators survive wrapping

When: slice 11. When a
  caller explicitly joins words with “ · ” and they exceed one line, the separator
  remains at the next line's beginning, possibly with a width violation. Replacing
  whitespace with a line break is layout; deleting the bullet would change chosen
  display text. The plan did not settle arbitrary separators. No text is removed
  to satisfy width limits.
Verdict: sound. Confidence: high.

### Held output allocation shares the native new-file owner

When: slice 05. FFmpeg needs a seekable output file. Its private runner creates
one new leaf through the already held attempt directory and replaces only an
explicit reserved null-device descriptor. The same exclusive creation primitive
serves native new-file writing. If the directory pathname is replaced, allocation
still uses the held directory, and later read admission requires the allocated
file's identity. Opening a writable absolute path in Node would lose that authority.

Gap: Node provides no openat, the system call that creates a child in a held
directory; the plan required that authority but did not settle its implementation.
Reach: CLI's private argument layout changes and Native depends on Media; release
must rebuild both together. No public operation or second publication owner is added.
Verdict: sound; platform allocation preserves the existing ownership rule.
Confidence: high.

### Artifact validation uses the attempt-bound native worker

When: slice 05. After FFmpeg retires, its file is reopened readonly with the exact
allocated identity, then a recipe-specific validator checks its meaning. That
validator and subsequent consumer receive the existing worker bound to the
attempt's held locks. A native reader therefore retains those locks even if the
service dies, rather than racing cleanup with an unbound process.

Gap: the plan required validation before publication but left validator access
and native-reader lock inheritance unspecified.
Reach: HDR and later artifact producers must supply their own domain validator;
exit zero and a hash alone never certify playable or correctly converted media.
Verdict: sound; staging, lifetime and cleanup keep one owner. Confidence: high.

### Review extents come from the caller with stated provenance

When: slice 09. An agent selects the range it wants reviewed and says where that
extent came from. The helper pins each revision and inspects bounded opening,
ending, join and selected middle windows. It does not derive a whole-revision
length by interpreting the edit document again. A partial event page or different
selected extent remains a partial comparison, with real continuation evidence.

Gap: no public canonical whole-revision extent was available to the consumer.
Reach: callers must choose review coverage explicitly; a bounded review cannot
claim complete watched or listened coverage. Verdict: sound; avoids a second
clock/extent interpreter. Confidence: high.

### Compare owner cut meaning separately from authored documents

When: slice 09. Splitting a continuous clip changes its document and occurrence
IDs without changing source mapping at the join. Review retains the document
hash and complete exact receipts, but excludes occurrence IDs when comparing
canonical cut meaning. Moving a clip changes that meaning. Equal cuts still say
nothing about picture or sound equality.

Gap: the plan asked to distinguish a split from a mapping change without naming
comparison operands.
Reach: review stays read-only evidence, never an output-equivalence certificate.
Verdict: sound; canonical events remain the timing owner. Confidence: high.

### Review budget exhaustion preserves missing work

When: slice 09. If selected windows or event pages exceed the total budget, the
helper reports skipped windows and the owner's real continuation. Pending and
failed requested pictures remain distinct from an unselected picture panel.
Display labels can shorten long IDs to fit beside markers, while the exact
manifest keeps full IDs. Quietly presenting an empty panel or fabricated complete
comparison would hide unfinished inspection.

Gap: the plan specified bounded review but did not choose aggregate admission or
missing-evidence presentation.
Reach: later helpers can reuse the same timeline renderer and budget transport;
no review queue, catalog or service endpoint is introduced.
Verdict: sound; missing work remains actionable evidence. Confidence: high.


### Reuse one finite alpha movie rather than introduce frame-sequence storage

When: slice 20. An external authoring tool can supply a finite ProRes 4444 MOV
with real alpha and explicit Rec.709 color metadata. Ordinary native decoding and
composition preserve its moving asymmetric marker on both backgrounds, including
rotation and mirror. Its single immutable byte identity and native sample support
already fit the asset model. A new sequence format would require member identities,
missing-member policy and another cadence manifest without solving a demonstrated gap.

Gap: the plan left alpha interchange representation to measured feasibility.
Reach: slice 21 reuses ordinary movie placement and portable retention. The frozen
recipe requires actual pixel conversion plus frame/container color properties;
codec options alone did not establish those properties in reproduction. ProRes
input support does not add ProRes or transparent final delivery.
Verdict: sound; the tested representation fits existing owners. Confidence: high.

### Every held source invocation starts from an explicitly rewound read lease

When: slice 04. FFprobe reads an inherited file descriptor and advances its shared
cursor. Starting FFmpeg afterward without rewinding can make valid media look
empty. Each invocation borrows its own held read lease and explicitly names source
descriptor slots to rewind; the existing native CLI runner checks they are regular
read-only files before seeking to zero. Other descriptors and default callers are
untouched. Forcing only the MOV demuxer could hide this bug for one format while
leaving the general held-input contract broken.

Gap: the plan required held bytes but did not prescribe cursor handling or
stream-selector mapping across container families.
Reach: FFprobe supplies only execution selectors; native facts retain clocks,
support and geometry. Track IDs must match, or a kind without IDs must be
unambiguous. Only self-contained demuxers and the fd protocol run managed inputs;
CAF and AAC remain covered alongside existing native families.
Verdict: sound; one general read-lease rule preserves original bytes without
reopening mutable paths. Confidence: high.

### Verify tools only when explicitly requested

When: slice 02. An agent checking whether the listener is ready should not wait
for the app's media files to be hashed and its tools to start. `service.health`
keeps its existing cheap answer. A separate `service.tools` request checks the
selected installation and returns bundled Node and verified FFmpeg paths.
Putting the expensive checks into health caused ordinary discovery to exceed
its deadline in reproduction.

Gap: the plan did not fix the discovery operation's placement.
Reach: callers explicitly request inventory; native operations remain available
when extra tools are absent. Inventory does not authorize backend substitution.
Verdict: sound; separates readiness from a bounded executable inspection.
Confidence: high.

### Sign private copies and pin their actual bytes

When: slice 02. Signing an executable changes its file contents. Staging first
checks the prepared distribution, copies it, signs that copy and writes a receipt
for the signed bytes. The selected app pins this receipt. The original prepared
distribution stays intact; copying its unsigned hashes would reject a valid
signed app or fail to describe what actually ships.

Gap: the plan required signatures and identities but left their sequencing open.
Reach: source builds and releases share the dependency owner's staging function;
source/recipe identities remain stable while signed executable identities vary.
Verdict: sound; binds discovery to the selected signed package. Confidence: high.

### Discovery reads bounded regular files and owns its probe processes

When: slice 02. If a bundled file is replaced by a FIFO, an ordinary file read
could hang waiting for a writer. Discovery opens without blocking, checks that
the opened object is a regular file, and enforces resource, byte and time limits.
It then probes versions through the existing CLI process owner, which retires
the entire process group before completion or cancellation returns. A generic
subprocess helper previously returned from abort while its child still ran.

Gap: runtime verification limits and subprocess ownership were unspecified.
Reach: discovery cannot hold service capacity indefinitely on these substituted
resources or release capacity while version-probe descendants remain alive.
Verdict: sound; uses the same lifetime contract as managed media execution.
Confidence: high.

### Keep uncertain preparation in its admission slot

When: slice 06. If importing a take times out, the helper cannot tell whether
nothing happened or a job is already running. It saves the intended call before
sending it, keeps that take in its concurrency slot and resumes with the same
import identity. For speech, it reads current status with preparation disabled
before deciding whether an explicitly requested retry is needed. A polling
budget ending does not free a running job's slot.

Gap: interrupted helper recovery and multi-stream admission were unspecified.
Reach: task manifests are durable caller-owned records, not another product queue;
failed siblings wait for pending work before retries admit more processing.
Verdict: sound; bounds outstanding work while preserving completed results.
Confidence: high.

### Retain literal caption meaning even when SRT cannot represent it safely

When: slice 12. A caption containing a timing-shaped line can become a second cue
in an SRT reader, and a literal tag can become formatting. SRT refuses these
ambiguous payloads with VTT guidance; ordinary comparisons and ampersands remain
literal Unicode. VTT escapes its own syntax and independently preserves the text.
The export freezes exact serialized content at admission, so later edits cannot
change an already requested delivery.

Gap: the plan required format-specific escaping but not ambiguous-text policy or
when serialization becomes immutable.
Reach: plain captions retain meaning; styling loss and newly rounded overlaps are
reported. Limits refuse whole requests rather than silently dropping cues.
Verdict: sound; follows independent reader evidence. Confidence: high.

### A CLI command finishes only after its process group is gone

When: slice 03. A command can exit while a descendant keeps running, even after
closing every pipe. The existing native worker runs an argv-only CLI mode and
reports command status on a private pipe while continuing its parent-death watch.
The service drains output and observes that the known process group no longer
exists before releasing staging or capacity. If the kernel delays retirement,
ownership remains held with bounded diagnostic polling rather than false success.

Gap: the plan did not prescribe topology, completion signaling or exceptional
retirement behavior. The private completion descriptor follows caller descriptors
and is closed when the real command starts, preserving inherited input numbering.
Reach: native JSON work and raw media commands share one lifetime owner, without
a second supervisor executable. Cancellation remains active through retirement.
Verdict: sound; prevents descendants surviving their owner. Confidence: high.

### Shrink transcript pages instead of keeping a hidden remainder

When: slice 07. If an exact transcript page will not fit the helper's output-byte
budget, the helper rereads the same opaque cursor with a smaller row limit. It
never consumes half the page and hides the remainder in private state. Literal
rows and their indexes survive; rounded phrase times only help navigation.
An oversized single row refuses instead of truncating evidence.

Gap: page splitting, byte accounting and continuation storage were unspecified.
Reach: continuation remains portable and pinned to revision/generation; every
attempt counts against a read budget. `prepare:false` makes absence a read-only
answer, while omitted preparation keeps existing client behavior.
Verdict: sound; preserves the transcript owner's pagination and clocks.
Confidence: high.

### Timeline pictures retain evidence rather than imply continuous coverage

When: slice 08. An agent asks for a few pictures, waveforms and words in one
window. The helper draws an SVG and retains exact JSON from the existing owners.
Picture cards connect to requested-time ticks and distinguish decoded times and
unavailable samples; sparse stills never claim continuous viewing. Faint word-row
guides are labeled as layout, so they cannot be confused with media support.

Gap: artifact format, sparse picture presentation and shared bounded-input owner
were unspecified. The common artifact reader also serves compact transcripts.
Reach: consumer conveniences reuse product clocks and delivered files rather than
opening internal caches or inventing a second projection. No speech preparation,
model download or edit follows from missing evidence.
Verdict: sound; truthful bounded review aid. Confidence: high.

### HEVC shares common controls but excludes H264-only settings

When: slice 25. A caller chooses HEVC explicitly. It receives native Main 8-bit
Rec.709 MP4 with the chosen preset's common bitrate, keyframe and AAC settings.
H264-only entropy and level fields refuse rather than being silently ignored.
H264 remains the default with its existing resolved settings. Native preflight
checks the requested combination and the receipt verifies the encoded header.

Gap: the plan left HEVC control shape, profile verification and unavailable
inventory behavior to reproduction.
Reach: the output schema distinguishes codecs; discovery reports HEVC readiness
separately, with no silent fallback or FFmpeg production dependency.
Verdict: sound; extends the existing output owner. Confidence: high.

### One source-built FFmpeg owner, replaceable shared libraries

When: slice 01. A release needs media executables that work after the app is moved.
The dependency owner builds FFmpeg 9.0.2 from a checksum-pinned official archive,
with shared libraries (separate replaceable library files), macOS system frameworks
and no automatically discovered Homebrew dependencies. Matching sources and the
build controller accompany the distribution. A static binary would hide the
libraries inside each executable and complicate replacement/relinking obligations.

Gap: the plan selected broad LGPL-compatible bundling but left version, linking
and source-delivery packaging to the reproduction.
Reach: future release and runtime paths consume this single prepared distribution;
a new external dependency requires a new recipe and affected re-verification.
Verdict: sound; keeps the selected build broad while making dependencies and
redistribution inputs explicit. Confidence: high.

### Tool tests join the root verification command

When: slice 01. New dependency-preparation tests would otherwise run only when an
agent remembers their individual command. The root test command now runs existing
workspace tests followed by the bounded tool-test suite; it adds coverage and
does not replace any existing tests. The plan required the full final check but
did not name an owner for these new pure Node tests. Future build-helper and
consumer-tool checks use this suite. Verdict: sound; one discoverable final gate.
Confidence: high.

### SDR correction uses explicit source-neutral Core Image semantics

When: slice 16. An agent requests cooler or brighter footage. The typed correction
will apply the requested source-white correction first, exposure second, and
contrast/saturation last in the existing extended linear sRGB picture context.
Source-neutral temperature describes the white being corrected toward 6500K;
lowering it cools gray, rather than acting as an arbitrary warmth slider. Contrast
pivots at linear 0.5. Transparent pixels preserve alpha, and intermediate values
can exceed the display range until existing output conversion. An alternative
camera-calibrated grade would need camera metadata and a separate validated recipe.

Gap: the plan named correction controls without specifying units, order or provider
semantics. Reach: recipe identity must include the actual Core Image/OS implementation;
missing bound recipes refuse. Initial static admission bounds are -8..8 exposure
stops, 0..2 contrast/saturation, 2000..10000 source-neutral Kelvin and -100..100
tint. These bound requests, not good taste or calibrated accuracy.
Verdict: sound; preserves the measured native recipe and existing source admission.
Confidence: medium.

### Native SDR provider identity joins the existing render identity

When: slice 17. A preview is queued, then the computer's OS changes its Core Image
provider recipe before the job runs. The frame/movie implementation identity now
contains that exact provider/OS identity. Existing cache keys and export snapshots
already retain and validate this value, so the old job refuses instead of changing
its processing or reusing an old picture. An alternative would add a separate
processor-identity map to every persisted frame, preview and export contract.

Gap: the plan required recipe binding but left its durable representation open.
Reach: even ungraded frame/movie caches are conservatively invalidated when this
provider identity changes. That trades cache reuse for a simpler single replay
owner; actual native defaults and ungraded pixels do not change.
Verdict: sound; the existing identity contract carries the recipe across all
consumers, and an independent old-job probe confirms refusal. Confidence: medium.

### HDR conversion has an explicit display policy and fidelity-preserving intermediate

When: slice 18. A caller explicitly converts supported PQ or HLG footage to SDR.
The selected recipe interprets a 1000-nit display and 100-nit reference white,
converts light and primaries, applies Hable tone mapping and clips gamut excursions
at the SDR boundary. Exact gamma is used because approximate HLG gamma changed
colored patches even when gray appeared correct. An internal ProRes 4444 MOV
without alpha carries the converted source; final exports keep their own formats.
Using H.264 at this intermediate step would add measured chroma-edge damage.

Gap: the plan left display assumptions, tone mapper and intermediate format open
to reproduction. Reach: conversion must record this policy rather than infer
missing creator intent; source and derivative clocks retain an explicit mapping.
This adds storage/encoding work and does not promise natural-scene or hue-preserving
wide-gamut fidelity. Verdict: sound; independent charts and exact-clock operands
support the selected bounded recipe. Confidence: medium.

### Color dependency preparation stays with the existing FFmpeg owner

When: reopened slice 01. The system-only build cannot convert the accepted HDR
transfer functions. Pinned zimg supplies that missing runtime library; a pinned
pkgconf resolves its build inputs privately and is not shipped as a runtime tool.
The FFmpeg provenance owner retains all source archives, notices, commands and
hashes. A separate dependency builder would duplicate release and recipe identity.

Gap: the initial broad build left required external dependencies to reproduction.
Reach: upstream pinned scalar/ARM source lists drive compilation, fixed private
compiler/search paths prevent host-library discovery, and verified archives precede
building. Private whitespace-free compilation avoids upstream configure parsing
assumptions; publication verifies any cross-filesystem copy before committing it.
Verdict: sound; one source/build/redistribution contract owns the dependency closure.
Confidence: high.

### Speech references distinguish human labels from aligned estimates

When: slice 22. An archive describes its annotations as manual, but its word
boundaries were produced by forced alignment, a model fitting text to sound. Those
boundaries cannot independently certify another model's timing. Human segment
labels remain useful for speaker scoring with their padding uncertainty recorded;
no additional timing accuracy claim follows from these labels.
Gap: the plan required independent truth but did not choose a corpus. Reach: future
providers cannot certify themselves by recycling machine labels. Verdict: sound;
reference authority stays independent. Confidence: high.

### Source-file permissions govern retained speech fixtures

When: slice 22. A dataset's overall card allows attribution-based reuse, while
individual recordings have different permissions. Retained inputs were selected
from individually compatible sources and keep original uploader/title/license
metadata. Copying every file under the dataset's headline license would lose the
actual source permissions. Gap: research fixture retention was unspecified. Reach:
new corpora must preserve per-file permission and attribution rather than assume
metadata licensing covers audio. Verdict: sound. Confidence: high.

### Speaker scoring preserves simultaneous anonymous speakers

When: slice 22. Two people speak at once. The tested provider configuration keeps
both anonymous speaker timelines instead of selecting only one speaker for each
instant. Matching them to reference names happens only inside scoring and does
not identify a person in product output. Gap: the plan required overlap but left
SDK configuration open. Reach: future registered providers must retain overlapping
observations and explicit unknown assignment. Verdict: sound. Confidence: high.

### Speech research shares input bytes but isolates execution

When: slice 22. Parallel experiments need identical large source/model downloads.
They share a read-only research cache while using private runtimes/build output
and explicit selected inputs. Research does not create product jobs or prepare
models through a read operation. Gap: experiment integration was unspecified.
Reach: promotion still requires the existing model, queue, evidence and publication
owners; a successful research script cannot become a second product pipeline.
Verdict: sound. Confidence: high.


### Relocated media proof executes the packaged service without the production host

When: latest-main integration. A relocated app now contains an authenticated
updater whose settings and replacement lock belong to the real macOS account.
Launching that production app for a scratch media test could touch those owners.
The archive check therefore continues to inspect signed archives without launching
the app or external launcher. A separate media check starts the packaged Node
service and JavaScript CLI with a private library and the packaged native/FFmpeg
paths. It checks delivered media but does not claim app-host or updater proof.
Gap: both branches had release checks with different runtime isolation contracts.
Reach: final acceptance must still join installed app/updater coordination with
media execution, including direct extras’ missing replacement exclusion.
Verdict: sound; keeps both useful proofs without borrowing personal state.
Confidence: high.

### Preserve signed FFmpeg resources after sealing their hashes

When: latest-main integration. Signing FFmpeg changes its executable bytes. The
media-tool owner signs a private copy and records those final hashes; signing the
whole app afterward must leave those exact files intact. The shared signing owner
accepts the exact resources already signed by that caller, signs the remaining
code and enclosing bundles, and still verifies every executable plus the app.
A failed verification refuses packaging. The alternative of signing those files
again after recording their hashes could invalidate tool discovery.
Gap: main’s enclosing signer and this branch’s tool receipt had independent order.
Reach: receipt-owning resources must finish signing before their hashes are sealed;
app signing cannot invalidate a child receipt. Verdict: sound. Confidence: high.


### Native export observation accepts captions without inventing a caption chooser

When: slice12 native observer follow-up. An agent can create an SRT or VTT
caption delivery through the shared export operation. When the native app lists
those exports, it must decode their kind and keep the same retry, abandon and
reveal actions as other managed deliveries. The app’s destination chooser cannot
create a caption export because it has no way to select the caption placements
to include; it therefore refuses that creation request instead of guessing.
Gap: the slice covered caption delivery but did not distinguish observing an
existing export from authoring one through an app flow. Reach: future app caption
creation needs explicit placement selection, while all managed export kinds must
remain visible to ordinary status and lifecycle handling. Verdict: sound; shared
meaning and explicit authoring are preserved. Confidence: high.


### Bound compressed inspection without claiming an AVFoundation memory ceiling

When: slice19 native qualification. A malformed or unusually large HEVC packet
could make the native decoder allocate and copy large buffers. Inspection checks
its reported storage size before asking for bytes and refuses packets or codec
configuration larger than 32 MiB. It copies and retires one packet at a time, checks
cancellation and retains sets of observed types rather than every packet. Ordinary
metadata discovery keeps its separate 64 MiB allowance before the same held input
can stream. These limits bound the inspector’s requested operands and copies, not
every allocation inside Apple’s AVFoundation framework. The alternative of reading
unbounded packets would provide no predictable refusal point. Gap: the plan
required bounded work but did not select this packet allowance. Reach: larger
packets need a measured, explicit admission change; they cannot silently bypass
the bound. Verdict: sound, with a deliberately finite initial policy. Confidence: medium.

### Complete compressed inventory is distinct from supported interpretation

When: slice19 native qualification. A source can have ordinary-looking metadata
while a hidden packet or codec configuration contains another interpretation.
Explicit inspection walks every decode packet, including material hidden by an
edit, and reports packet/configuration identities, combined supplemental-metadata
types and refusal reasons. “Complete” means all packets were inspected; it does
not mean conversion is allowed. Missing, incomplete or unsupported inspection
cannot become an all-clear result, and the separate presented-timing digest still
qualifies the frames actually shown. Gap: the optional inspection result and
traversal contract were unspecified. Reach: conversion admission must check the
whole result and preserve the distinction between byte interpretation and timing.
Verdict: sound. Confidence: high.

### Conservative HEVC qualification refuses unproved interpretations

When: slice19 native qualification. A phone movie can carry display instructions
in packets or codec configuration even when its color labels appear familiar.
The initial inspector qualifies only the single-layer hvc1 encoding form, permits
ordinary coded pictures and filler, and refuses other supplemental metadata or
in-band parameter declarations. It requires one complete out-of-band video,
sequence and picture parameter declaration—the codec’s decoding setup—and refuses
multiple declarations or changes in the native format, even harmless vendor
labels. It inventories those declarations without implementing a second codec
semantics decoder. Thus an Apple encoder’s unregistered metadata is conservatively
refused; a deliberately stripped fixture is not proof of broad phone-HDR support.
Gap: the plan left unproved compressed interpretation families unspecified. Reach:
future expansion needs fresh interpretation and pixel proof, while managed HDR
conversion still must preserve its frozen transform and accepted source operands.
Verdict: sound as a narrow prerequisite, not completion of HDR conversion.
Confidence: medium.

### Primary byte authority also covers ordinary metadata admission

When: slice19 native qualification. A MOV file can point its samples at another
file. Apple’s restriction prevents actual external decoding, but observed metadata
loading still succeeds. Ordinary probe admission therefore visits each native
chunk’s storage locator, including hidden video and audio, and refuses observed
foreign storage without reading packet payloads. Explicit scanning checks that
authority before generating each packet and compares the returned format and
clocks to the native cursor. Loader failures retain their original refusal code
through framework errors. An absent cursor is never proof of decoding support.
Gap: the earlier native probe assumed the primary file implied all sample storage.
Reach: source-bearing consumers need the same retained owner and real execution
checks; metadata inspection alone cannot certify it. Verdict: sound. Confidence: high.


### Direct media tools share the installed launcher’s replacement lock

When: slice26 following latest-main integration. An agent requests a GIF and runs
bundled FFmpeg while the app update wants to replace that same binary and its
libraries. The released `screenrec` launcher now accepts `ffmpeg` or `ffprobe`,
locks the installation before reading the app, then becomes that tool process.
Its inherited operating-system lock survives for the tool’s lifetime. Tool arguments,
standard streams and exit status are unchanged, and no service job or managed export
is created. Calling a discovered binary path alone would bypass replacement protection;
building a service operation per filter would expand the product unnecessarily.
Gap: the plan allowed direct bundled extras before authenticated updating landed,
without selecting how those lifetimes would coexist. Reach: consumer fallback uses
the released launcher; raw paths remain discovery and internal execution evidence. Automatic updates
retain the external launcher, so agents verify both passthrough versions and refresh
an older launcher explicitly from a checksum-verified release kit. No runtime
negotiation or automatic launcher updater is added. The component proof uses scratch account lookup, so signed packaged acceptance still
must exercise the final artifacts separately. Verdict: sound; one existing lifetime
owner protects both CLI and direct tools. Confidence: high.

### Ordinary source paths retain authority before native preparation

When: source-owner follow-up c1168c1a. A source path can be replaced after native
preparation while a picture or audio read is still running. The shared input owner
now opens and retains the original regular file for ordinary paths as well as inherited
handles. Picture preparation and capture recovery keep this owner alive, qualify
selected sample storage, then explicitly switch from bounded metadata reads to
streaming. The alternative URL-only decoder could resolve another file or an external
MOV reference after admission. Existing symlinks resolve before the final leaf is
opened without following a new leaf link; original permission errors keep their
operational meaning. This protects close, unlink and pathname replacement, while
existing file-version and admission checks still own in-place content mutation.
Gap: the follow-up required shared authority but did not specify regular-path retention
and wrapper-error preservation. Reach: all live source consumers share the same
metadata/streaming boundary; generated-output inspection is a separate contract.
Verdict: sound. Confidence: high.


### Optional runtime assembly preserves primary Python startup and ordered layers

When: shared assembler/worker checkpoint b8839b3b. The accepted speaker runtime
imports packages from a primary dependency tree and two supplementary trees.
Flattening those directories or processing every Python path-hook file again could
select another package or execute hooks the original runtime never ran. One common
clone-only assembler therefore preserves the primary tree’s ordinary interpreter
startup, then a bundle-local entry appends supplementary trees in original order.
Only explicitly identified files listing admitted donor paths are omitted; nested
checkpoint files using the same extension stay intact. Separate immutable model
bytes remain separately prepared. The voice-specific assembler is replaced rather
than left as a parallel packaging owner. Gap: the accepted relocation contract did
not select a shared layout or layered bootstrap. Reach: optional inference purposes
share this assembly owner, while package trimming or native load-path changes need
their own frozen receipts and relocation proof. Verdict: sound. Confidence: high.

### Invalid speaker observations retain lossless native diagnostics

When: exact-original worker checkpoint b8839b3b. The model can return an unexpected
axis order, a nonfinite score or an endpoint outside its30s input. The worker reserves
fresh output files before loading the model and saves native tensor type, dimensions
and original bytes plus original segment text before interpreting them. It requires
the pinned batch/time/speaker axes rather than reshaping a transposed result into an
apparently valid observation. A caught failure removes only this attempt’s empty
reservations; captured diagnostic bytes remain unverified, and process-death cleanup
belongs to the existing caller. Converting invalid scores to JSON numbers or replacing
them with null would lose the operand needed to understand the failure. Gap: the
plan required raw-output retention but did not select invalid-tensor encoding or
empty-reservation cleanup. Reach: later durable publication must consume only validated
observations while preserving failed native evidence separately. Verdict: sound.
Confidence: high.
### Darwin workers retain parent descriptor bookkeeping through the bundled runtime

When: audio state acceptance after `92219937`. An eighty-clip preparation keeps
one completed audio file open per processed clip. As the list grows, a child
receives some lower-numbered files in higher-numbered slots. Bundled Node
24.21.0/libuv1.52.1 can then close unrelated parent descriptors because its Darwin
process-creation code rewrites the parent's descriptor bookkeeping while planning
child-only moves. A later native child starts with its input replaced, exits
without reading the request, and the preparation fails despite ample descriptors.
The shared worker now requests its existing user's ID for inherited-file calls
from an ordinary account whose real and effective IDs agree. In this pinned runtime
that selects libuv's safe fork path. The focused regression proves the user,
effective user, primary groups and supplementary groups are unchanged, every
out-of-order operand still holds its expected bytes, and the child retires.
The alternative is a fixed supported Node release; none was available when checked.
No custom runtime build, second process owner or domain count cap is introduced.

Gap: the plan assumed the selected runtime preserved inherited-file authority.
Reach: both native JSON and argv-only CLI calls share this correction. It is
scoped to ordinary non-root accounts; it adds no root or identity-switching
execution guarantee. Remove it once the bundled supported LTS contains
[the merged upstream fix](https://github.com/libuv/libuv/pull/5284), then recheck
out-of-order descriptors, locks, cancellation and retirement. Early frame-buffer
and temporary-fd-scan guesses were falsified or superseded by the actual child
flags and upstream bookkeeping cause; they are not implementation premises.
Verdict: sound as a measured temporary runtime workaround. Confidence: medium.

### Durable render identity includes the actual audio preparation implementations

When: shared audio execution in `9f7d4567`. A service prepares audio using one
verified tool receipt, then restarts with a different verified receipt while the
project and requested controls stay the same. Both the audio and movie renderer
identities include the ordered processor bindings—the concrete native and bundled
implementations that execute the request. Existing cache/job/export owners therefore
see a different recipe and cannot return an earlier unprepared result as if it used
the replacement. The runtime is rechecked before execution; this does not select
another provider when one is unavailable. Removing the identity contribution
reproduced stale job reuse in the actual public socket journey.
Gap: the frozen recipe required implementation identity without specifying the
existing renderer/cache key's contribution.
Reach: durable reuse and retry retain executable meaning even across a runtime
replacement; no new cache, queue or version-negotiation owner is added.
Verdict: sound; this uses the existing durable recipe owner. Confidence: high.

### Portable adoption checks evidence against its recorded bound recipe

When: shared audio execution in `9f7d4567`. A portable processed project opens on
a new library, whose freshly compiled requirements have no implementation IDs
assigned yet. Adoption first finds the semantically matching recorded prepared
recipe and binds those recorded implementation IDs for evidence validation. It
then verifies the retained measurements against that bound recipe. Comparing
against the fresh unbound requirements refused valid packages; copying current
local implementation IDs instead would relabel earlier processing as a different
runtime. The actual export/open/adopt journey now preserves the original full-domain
records and survives closure of its donor package.
Gap: the plan did not say how imported evidence meets fresh compiler requirements.
Reach: adoption preserves recorded preparation meaning; executable readiness and
future reprocessing still use current support admission. It adds no runtime fallback.
Verdict: sound; the recorded recipe owns the evidence it produced. Confidence: high.


### An authored interval without output samples produces no processing evidence

When: shared audio execution in `9f7d4567`. A one-microsecond clip can lie inside
a longer output while contributing zero samples on the declared 48 kHz clock.
Its external state domain is skipped for execution and contributes no held audio
file or meter record. The document and complete compiled recipe retain the
explicit request; the surrounding output still has its own exact sample count.
Running a loudness meter on an invented empty file would add evidence for a signal
that the output clock does not contain. A positive-length silent domain still
runs and correctly refuses normalization as unmeasurable.
Gap: the plan did not specify external processing at a sub-sample interval.
Reach: native span admission and core processing evidence both use positive sample
support, without inventing context, silence or a new edit. The native/service
sub-sample fixture verifies zero output and no external record.
Verdict: sound under the exact output clock. Confidence: medium.


### HDR conversion binds explicit input interpretation without changing its transform

When: slice 19 encoded source research. Native and held FFprobe declarations can
agree while a decoder's frame defaults still differ; the execution recipe must
bind the qualified meaning. Explicit zscale input primaries, transfer, matrix and
limited range pins were accepted only after matching both raw RGB and complete
ProRes bytes to the frozen recipe on dedicated PQ/HLG HEVC controls. Wrong range
pins falsify that parity. The recipe's numerical transform and identity stay
fixed; unqualified or conflicting source declarations refuse instead of using
another interpretation. Gap: the plan did not specify whether qualified input
meaning should remain an implicit decoder default or be bound in execution. Reach:
managed conversion must consume the same qualified meaning and frozen transform;
new source families require their own parity proof. Verdict: sound for the two
measured encoded controls, with managed support and publication still unfinished.
Confidence: medium.


### Optional speaker preparation accepts explicit local inputs

When: original runtime checkpoint, resolved by the user's fixture-based scope
instruction. A caller prepares the speaker model using explicit local model and
runtime sources. The app bundles FFmpeg, but not the roughly2GB speaker runtime.
The original local artifact works; its dependency redistribution materials are
incomplete, so automatic speaker runtime delivery is not a feature of this spec.
Gap: initial planning allowed useful bundled tools without selecting a speaker
runtime distribution. Reach: missing speaker inputs report unavailable and never
trigger a hidden installer or download. The tested original computational recipe
and source-evidence contract remain unchanged. Verdict: sound; supports the
proven local workflow without an unverified distribution promise. Confidence:
high under the user's explicit instruction to remove unprovable scope.

## Sound — lower confidence first


### Allow only named thin-arm64 loader-search metadata edits

- When: native packaging closure gate.
- The choice: remove explicitly inventoried foreign absolute loader search paths
  from cloned native files, then re-sign those clones ad-hoc. An imported wheel
  may still mention its builder's Homebrew/Anaconda directory even though its
  required libraries are inside the artifact. Removing that search path prevents
  accidental donor lookup; its computational sections, addresses, flags and full
  dependency command kinds/version requirements must remain identical. The
  policy cannot change install identifiers, model weights or code sections.
- The gap: native inspection found 54 affected files and 56 search commands; the
  permitted relocation operation and size of complete diagnostics were unspecified.
- The reach: this helper admits only thin arm64 Mach-O and up to 64 MiB combined
  before/final operands. Other architectures or larger diagnostic sets need an
  explicit new packaging policy, not an invisible broader rewrite. The retained
  full binary operands remain locally outside the runtime; repository evidence
  stores their hashes/section/load observations without redistributing binaries.
- Verdict: sound for this frozen closure, which preserves 656 native sections and
  passes origin checks. The finite bound makes oversized packaging refuse early.
  Ad-hoc signature success is not product signing or redistribution acceptance.
- Confidence: medium.


### Exclude developer metadata without rewriting donor links

- When: first assembly refusal and repaired assembly.
- The choice: leave base pkg-config metadata outside the execution closure. The
  first attempt found two developer symlinks pointing into vanished download
  scratch, and refused rather than guessing targets. Python and its admitted
  runtime libraries do not need that build-tool metadata to execute. Rewriting
  the donor or manufacturing a target would invent authority and violate source
  preservation; a synthetic escaping-link check proves the selected exclusion.
- The gap: the initial base-library inclusion rule also admitted development-only
  metadata, with no policy separating build lookup from execution lookup.
- The reach: one clone-only assembler still owns the artifact; actual execution
  files and package/model license metadata remain retained. The failed attempt,
  repair protocol and final assembly receipts stay available as history.
- Verdict: sound; execution origins and exact original outputs pass after the
  one allowed mechanical repair, without donor changes or package upgrades.
- Confidence: high.


### Freeze historical execution and strengthen its retrospective evidence

- When: final independent review.
- The choice: keep the original invocation/protocol byte-for-byte intact and add
  a post-run verifier that compares the complete retained actual runtime inventory
  to the expected pre-bound assembly digest. Review found the original driver
  computed a new digest without checking that expected identity before preparation.
  A changed runtime could therefore have been accepted by that harness. The
  actual retained descriptor/inventory matches the expected digest, all sources
  and all 15 semantic fields. The new model-free refusal control rejects a changed
  inventory and saves both complete operands before its gate. A later native
  failure correction saves invalid final bytes/hash and preserves the original
  command failure; its original execution source is archived at the frozen hash,
  and the post-run observer reports current-source evolution explicitly.
- The gap: the frozen invocation omitted an explicit artifact-target comparison;
  re-running an expensive model to repair a historical observer would not change
  the already retained operands and could obscure the exact one-call scope.
- The reach: the historical driver must not be reused; future protocols must bind
  and validate their actual runtime before preparation. Its current source/temp
  facts remain honest: owned TMPDIR was proved only by the import probe, while
  the model invocation used default tempfile with explicit model/cache paths.
- Verdict: sound; independent post-run verification closes the observed identity
  claim without rewriting history, reassembly or another model-bearing call.
- Confidence: high.


## Source PCM prerequisite decisions

### Assemble the bounded speaker PCM operand in memory before publication

When: source-speaker PCM e143bb32. Choice: accumulate the one fixed30s mono
Float32 operand (1,920,000 bytes) before the existing atomic file owner publishes
it. A streamed file sink would add lifetime machinery without a current memory
need. The spec required complete immutable PCM but left the sink structure open.
This reaches only the bounded internal primitive; admitting larger windows must
revisit the finite allocation, rather than silently scaling it. Verdict: sound
within the fixed observation size and current margin. Confidence: high.

### Apply existing strict source-format policy only to selected-channel observations

When: root source PCM review. Choice: let the existing spans decoder opt into its
existing strict format validation and select that policy for speaker PCM. This
refuses a stereo-to-mono transition before a decoder can synthesize channel one;
ordinary transcription spans keep their established default. The spec forbids
implicit channel mixing but did not choose how to connect native format admission.
This adds one native API parameter consumed by the observation sink, with no new
validator or public operation setting. Verdict: sound; one source-format owner
protects channel identity while existing native behavior stays intact. Confidence:
high; public generation/decoder identity remains a later integration contract.


## Decoded-audio prerequisite decisions

### Refuse unfamiliar decoder trimming rather than infer another trim

When: decoded-audio checkpoint 171d8728 and root integration. Choice: observe the
actual Float32 samples and their timestamps after the native decoder applies its
own AAC priming and end treatment. If a sample still carries a trim instruction,
refuse this conversion path rather than applying that instruction again. For
example, an independently authored 6,000-frame AAC source emits exactly 6,000
frames; its copied stream decodes identically, but its lossy samples are never
claimed identical to the pre-encode source. Gap: the plan required decoded sound
and exact timing but did not choose how to admit decoder-managed trimming. Reach:
this scanner supports integral native-rate mono/stereo, one stable format and
buffers of at most 65,536 frames. Larger or unfamiliar output refuses rather than
being mixed, resampled or rewritten. This is a conservative conversion admission,
not a universal codec guarantee. Verdict: sound within the disclosed scope;
broader formats need their own observed admission. Confidence: medium.

### Preserve emitted sound separately from occupied source support

When: decoded-audio checkpoint 171d8728 and root integration. Choice: keep decoded
run positions and a digest of the emitted PCM separately from container segments.
A leading-empty AAC control emits silence before occupied sound; the observation
retains those negative positions instead of masking them away or calling them
acquired audio. Gap: the plan did not choose a representation for disagreements
between decoder output and container occupancy. Reach: later conversion must
compare both operands before publication. Ordinary probes omit the opt-in scan;
the existing native worker and verified metadata-file owner carry it. No new
public operation, queue or persistent evidence owner is added. Verdict: sound;
actual output remains inspectable without manufacturing physical support.
Confidence: high.

### Admit contiguous occupied audio before preserving a common movie clock

When: selected-audio clock checkpoint 2212132b and root integration. Choice: for
the first conversion path, require one unretimed occupied audio segment whose
endpoints, frame count and sample rate exactly match the one observed decoded
run. A decoder that emits silence through an empty edit therefore refuses; the
conversion does not manufacture or mask sound. Gap: the plan required faithful
support without prescribing a first admission shape for fragmented edits. Reach:
fragmented or retimed source audio needs a later explicit materialization path;
it cannot enter this path merely because decoding finishes. The movie clock also
represents every native audio sample cell, and both selected streams use their
earliest occupied start as one zero, preserving relative offsets. Verdict: sound
as disclosed conservative admission, with broader selected ranges still open.
Confidence: medium; this is intentionally narrower than arbitrary imported media.

### Copy selected encoded audio and validate its actual decoded identity

When: optional-audio producer 417cf79e and root integration. Choice: preserve the
explicitly selected encoded audio without re-encoding, then decode the derivative
with the same admitted native reader and compare its complete samples and exact
source-clock mapping. An AAC source therefore keeps its already decoded sound;
it is not subjected to another lossy pass or compared against pre-encode PCM.
Gap: the plan did not select a first audio transport for the HDR derivative.
Reach: container-copy failures or altered decoder support refuse this path; no
resampler or encoder substitutes silently. The existing deadline owner receives
the union of selected video/audio support so a short video cannot give longer
audio an artificially short processing budget. Verdict: sound within the admitted
contiguous source scope. Confidence: high.

## Speaker persistence and portable HDR choices

### Compress the verified speaker descriptor into the existing service bundle

When: speaker foundation 0fc85caf. A released service is one bundled JavaScript
file. Its verified speaker descriptor contains the complete runtime inventory,
so the registry embeds compressed JSON rather than adding another resource loader.
Parsed values and all runtime entries match the retained original descriptor;
minification changes JSON serialization bytes. The model/runtime identities stay
unchanged. Gap: the plan did not select descriptor packaging. Reach: discovery
must not print the full inventory, and changing dependencies still requires a new
verified identity. Verdict: sound; fits the existing bundler without another
installation owner. Confidence: medium because the generated source is sizable.

### Retained speaker reads use the observation's decoder and chronological order

When: retained-read correction 973b64da. An app upgrade changes the installed
decoder, but an already published observation still reads with its original
decoder identity and needs no model runtime. Source/channel/range and engine
semantics remain pinned. Native output groups intervals by speaker slot; stored
chronological sequence supports paging while retaining each original native
ordinal. Gap: the plan required durable reads without prescribing this lookup
and ordering. Reach: new observations use the current decoder; old pages cannot
silently switch observations. Verdict: sound; evidence survives upgrades without
rerunning inference or losing simultaneous speakers. Confidence: high.

### Portable HDR derivatives retain the original source and occupied support

When: HDR provenance b6c79ebe. Exporting a project containing a converted movie
also retains its immutable original. The conversion receipt binds both movies'
selected streams, occupied media support, exact common clock and audio identity;
package admission compares the receipt to both retained metadata records. Gap:
the plan required provenance but left its portable representation unspecified.
Reach: catalog26 refuses older catalogs, including the intermediate speaker25
schema; no migration or personal-library deletion occurs. Verdict: sound; uses
the existing asset dependency and package owners. Confidence: high.

### Canonical conversion requests recover their original frozen job

When: managed HDR6dc1a796. Repeating the same immutable asset, selected streams
and recipe returns its existing conversion job, even when tools have been removed
or relocated. The queue retrieves the saved exact input by a semantic request
key; execution still requires its frozen binary hashes. File paths locate those
binaries but do not identify the recipe. Gap: the plan required replay without
choosing an additional request-ID field. Reach: callers use shared job retry or
cancel rather than silently generating a new conversion under changed tools.
Verdict: sound; preserves saved output and reuses existing indexed job/artifact
rows without another receipt store. Confidence: medium because this extends the
queue's lookup contract to canonical JSON request keys.

### Final acceptance proves a local bundle, without publishing a release

When: final package acceptance. The finished app can be checked after moving it
to a scratch directory, using its bundled Node and media tools. Production
release signing needs credentials that are not available in this workspace.
The local check records its actual signature and source identity, rather than
pretending to be a signed production release or leaving release publication as
an unfinished feature. The existing CI still signs and checks published archives.

Gap: the original package gate coupled tool verification to release credentials.
Reach: closure certifies the local packaged tools and scratch media contracts;
it makes no new updater, notarization or published-release claim.
Verdict: sound; matches the user's request to finish supported fixture-proven work
and keep validation small. Confidence: high.
