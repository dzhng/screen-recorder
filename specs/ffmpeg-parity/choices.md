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

### Timed event research keeps coarse labels and model context explicit

When: independent temporal-event research. Human dataset annotations say which
100 ms scene bins contain laughter or clapping. YAMNet instead scores overlapping
975 ms audio contexts every 480 ms. The frozen diagnostic assigns each reference
bin's midpoint the nearest model patch center, with earlier-center tie handling.
It never expands detections with neighboring maxima or claims 100 ms endpoint
precision. A provider must pass this declared recipe before a product interval
contract is considered; the current candidates fail.

Gap: the plan required independent timed events but did not prescribe how to
compare differently sampled observations. Reach: microphone channel zero is an
explicit pre-inference projection, not independently listened channel-specific
truth. Other categories cannot borrow Clapping's labels, and all confirmation
sources are consumed once complete scores exist, including unselected classes.
New providers need new untouched confirmation. Verdict: sound for a bounded,
explicitly limited diagnostic; these operands cannot certify finer endpoints or
isolate projection error from model error. Confidence: medium.

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
word-boundary evaluation waits for complete independently corrected neighbors.
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

### Untimed acoustic tags support presence diagnostics only

When: slice 22. A recording is labeled as containing a laugh but has no exact
laugh interval. The first inexpensive comparison asks only whether the model
finds that category anywhere, retaining all raw scores. Even a presence pass would
not establish start/end accuracy for production event evidence. Gap: the plan
required timed events without supplying timed references. Reach: a separately
annotated interval cohort is necessary before that family can ship. Verdict: sound;
the smaller diagnostic has an explicitly smaller claim. Confidence: medium.

### Speaker scoring preserves simultaneous anonymous speakers

When: slice 22. Two people speak at once. The tested provider configuration keeps
both anonymous speaker timelines instead of selecting only one speaker for each
instant. Matching them to reference names happens only inside scoring and does
not identify a person in product output. Gap: the plan required overlap but left
SDK configuration open. Reach: future registered providers must retain overlapping
observations and explicit unknown assignment. Verdict: sound. Confidence: high.

### Failed confirmation scores remain separate from calibration

When: slice 22. The initial models miss brief tagged effects. Lowering thresholds
on those same files could improve the score but would turn confirmation into
tuning. Their failed scores remain frozen; later calibration uses separate
development inputs and freezes settings before untouched confirmation. Gap: the
plan gave quality gates without a calibration procedure. Reach: new provider
selection cannot hide failure by fitting its acceptance examples. Verdict: sound.
Confidence: high.

### Speech research shares input bytes but isolates execution

When: slice 22. Parallel experiments need identical large source/model downloads.
They share a read-only research cache while using private runtimes/build output
and explicit selected inputs. Research does not create product jobs or prepare
models through a read operation. Gap: experiment integration was unspecified.
Reach: promotion still requires the existing model, queue, evidence and publication
owners; a successful research script cannot become a second product pipeline.
Verdict: sound. Confidence: high.
