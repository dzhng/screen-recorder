# Implementation choices

Choices made where the plan was silent; explicitly delegated internal details
are omitted. Planning decisions remain in [decisions.md](decisions.md).

## Sound — medium confidence

### Small, ordinary compressed timing fixtures

When: corpus pass, `b1fc5fe`.

The choice: numbered clips use low frame rates and High-profile H.264 with modest
compression. When a check asks which frame appears at a cut, there are few frames
to inspect and each has a visible identity. Lossless H.264 would preserve exact
colors but selected a less broadly supported profile; tests instead allow a small
color error while checking frame identity. The plan required deterministic,
asymmetric clips but did not select encoding or frame rate.

The reach: these fixtures prove timing and basic geometry, not production motion
quality or native compatibility. Native decode and high-rate preservation have
separate gates. Verdict: sound because compact fixtures expose exact boundaries
without requiring an unusual decoder profile. Confidence: medium.

### Byte reproducibility is tied to recorded tool versions

When: corpus pass, `b1fc5fe`.

The choice: regenerating with the recorded encoder and runtime must reproduce the
same bytes. A different encoder release may write different bytes for the same
pictures; the manifest records tool versions and generator hashes rather than
promising otherwise. The plan required determinism without defining its toolchain
boundary.

The reach: future fixture updates must preserve the frozen inputs or deliberately
record a new toolchain and evidence. Verdict: sound because it makes the actual
reproduction guarantee checkable. Confidence: medium.

## Sound — high confidence

### A timestamp jump is not evidence of a native acquisition gap

When: corpus pass, `b1fc5fe`.

The choice: a video timestamp jump is paired with explicitly synthetic acquisition
metadata. A decoder can hold the prior picture across the jump; the separate
metadata says recording was unavailable there. The fixture does not claim to
contain a native empty edit-list interval. The plan requested gap cases without
choosing how this small generated case would encode one.

The reach: consumers must distinguish displayed held pixels from evidence that
media was actually acquired. Existing native empty-gap references remain required.
Verdict: sound because it avoids treating a convenient synthetic case as proof of
a different media mechanism. Confidence: high.

### Retain one thumbnail by decoded-buffer identity

When: native baseline maintenance, `babc2f7`.

The choice: when thousands of tiny cuts revisit the same held video frame, reuse
its thumbnail. The cache holds a strong reference to that exact decoded buffer,
so a different frame cannot accidentally reuse its identity. Empty intervals
clear it. Every cut still emits its own timing row. The alternative was to redraw
the same pixels thousands of times, or maintain a larger timestamp-keyed cache.
The plan required bounded work but did not select this cache identity.

The reach: memory includes at most one extra retained source buffer and one small
thumbnail; timing and output budgets stay unchanged. Verdict: sound because the
cache follows the existing decoder's actual held-frame lifetime without changing
sample selection. Confidence: high.

### Probe presentation timing without retaining every frame timestamp

When: slice 02 native metadata checkpoint.

The choice: when importing a long video, the probe walks its sample cursor and
reports the presented sample count, first/last timestamp and duration range. It
maps the file's edit list—the instructions selecting and repositioning encoded
media—before counting. It does not return a potentially huge per-frame JSON list.
The plan required actual timing metadata but did not choose its summary shape.

The reach: metadata can identify variable timing and preserve stream offsets with
bounded sample memory. Exact frame selection still reads the source through the
native timing owner; a summary cannot replace source evidence. Verdict: sound
because it preserves the shared presentation clock without making import responses
grow with every frame. Confidence: high.

### Reverse lookup returns an interval rather than one guessed timestamp

When: slice 01, `b1b08f3`. Confidence: medium. Verdict: sound.

The choice: at slow playback, several project microseconds can point to the same
source microsecond. A source-time query therefore returns the whole matching
project interval and its first integer time, or null when fast playback skips that
source microsecond altogether. A held frame returns the entire hold. The plan
required all occurrences and exact rounding but did not specify inverse query
shape. The reach: evidence projection can represent repetition and holds without
losing occurrences; callers must not assume one source time has one project time.

### Attached content inherits its parent's unavailable intervals

When: slice 01, `b1b08f3`. Confidence: medium. Verdict: sound.

The choice: an overlay attached to a particular occurrence of captured content
retains its full placement envelope, but reports unavailable intervals wherever
that parent content was not acquired. Independently placed project-time content
remains independent. The plan required source gaps and content attachments but
did not spell out their intersection. The reach: render/inspection consumers must
honor that distinction; attaching content never invents acquired source material.

### Decode nearby cuts once; reset the conversion filter at every cut

When: baseline maintenance, `0147c63`. Confidence: medium. Verdict: sound.

The choice: many tiny cuts share one source decoder, but each selected interval
gets a fresh rate-conversion filter. This avoids thousands of expensive decoder
starts while preventing excluded neighboring audio from influencing a cut through
the filter. One decoded packet is retained; a gap exceeding one second restarts
reading instead of decoding an arbitrarily long excluded span. The plan required
bounded work and cut isolation but did not set this reuse boundary.

The reach: the one-second threshold trades decoder startup against bounded
skipping; it does not alter samples admitted to the filter. Source reordering in
future executors must start an appropriate reader rather than treating this ordered
cursor as random access. Long-stream scale acceptance remains separately required.

### Persist exact fractions when an edit creates a fractional boundary

When: slice 03a. Confidence: medium. Verdict: sound.

The choice: a clip selecting ten source microseconds plays over six project
microseconds. Splitting it at project time two requires source time10/3. Rounding
the stored split to3 changes a later query from source time5 to4. Stored clip and
anchor endpoints therefore accept reduced fractional microseconds, while whole
values remain numbers and requested command coordinates stay integers. Both
fraction components must fit safe integers; unrepresentable results fail rather
than round silently.

The gap: the original integer-only document could not preserve its own affine
mapping under arbitrary retimed splits. The reach: the reducer, compiler and
portable document readers inherit one exact representation; they must not coerce
stored endpoints to numbers before the declared sampling boundary. This avoids
adding a second speed or hidden original-mapping field to every edited clip.


### Admit an import and its job in the same transaction

When: slice 02a admission integration. Confidence: high. Verdict: sound.

The choice: when an agent imports a file while the queue is full, neither a job
nor a new frozen import record is saved. The queue runs a synchronous request
factory inside its existing database transaction; that factory creates the import
record and returns the job request. A capacity failure rolls both back. Source
inspection happens beforehand, and media processing starts after commit.

The gap: the plan required bounded admission and immutable retries but did not
specify how the import owner joins queue admission. Saving imports first would
leave unlimited rejected requests behind; a cleanup worker would add another
lifecycle. The reach: future preparation owners can share this transaction, but
must keep asynchronous file work outside it. Previously accepted request replay
still uses its frozen identity without reopening the external source.


### Explicit track setup and inspectable deterministic batch results

When: slice 03 reducer foundation. Confidence: medium. Verdict: sound.

The choice: an agent first adds the tracks it needs, labels them inside the batch,
then places streams on those tracks. Changing the canvas leaves clip timing
intact. Removing a track containing clips asks for explicit clip edits first;
removing an already absent track succeeds. This avoids silently deleting media
when the agent only requested a layout change.

The gap: the plan defined tracks and atomic edits but left track creation and the
receipt format unspecified. The transaction owner supplies a stable namespace;
entity kind and a batch ordinal produce repeatable IDs. Each operation returns
its changed entities, while the final changed flag compares the initial and final
documents. Adding and removing a track in one batch is therefore a net no-op.
The reach: storage can replay requests without inventing fresh identities, and
agents can inspect the same expansion that produced the resulting document.


### Name split children by their original occurrence

When: slice 03 splitting. Confidence: high. Verdict: sound.

The choice: an agent splitting linked audio and video can name the right video
and right audio in that operation, then independently edit those named pieces
later in the same batch. Each label identifies an original occurrence and binds
to its new right child. If that occurrence lies outside the cut and produces no
right child, the batch fails explicitly instead of selecting unrelated footage.

The gap: the plan required in-batch labels and split lineage but did not define
how a multi-stream split exposes more than one new identity. The reach: callers
can compose edits atomically without predicting IDs or sending intermediate
requests. The left surviving clip and first surviving synchronization group keep
their IDs; additional children/groups use the same batch identity allocator.

### Metadata stays readable regardless of import history

When: asset admission integration. Confidence: high. Verdict: sound.

The choice: importing the same bytes from many paths adds provenance to one
asset. Reading its immutable metadata does not also load that entire history;
asset.origins returns a bounded page and continuation cursor. Asset lists likewise
return compact summaries, with full stream metadata available by identity.

The gap: the plan required bounded inspection but left response boundaries and
cursor shape open. Provenance uses the existing lexical database key, so a
concurrent insertion before the cursor appears on a refreshed traversal. Fixed
history traverses exactly once. The reach: agents must follow pagination to inspect
all origins, while a large history cannot make ordinary metadata unreadable.

### Keep a safe media extension without making it asset identity

When: immutable asset admission. Confidence: medium. Verdict: sound.

The choice: two files with identical bytes share one hash identity, while the
managed file retains a bounded, safe original extension so native decoders can
open it. The first admitted copy owns the stored filename. Native probing, rather
than the extension, determines the actual streams. The gap: the plan did not
specify physical names; extensionless managed movies failed AVFoundation decoding.
The reach: original bytes remain unchanged, but extensionless or mislabeled input
may still produce an explicit native decode error. This does not classify its
codec as unsupported or introduce a second decoder into production.

### Compare native render timing independently from color interpretation

When: slice 06 reproduction. Confidence: medium. Verdict: sound.

The choice: use the bounded reader/compositor/writer mechanism for the demonstrated
preview, gap and tail timing cases. Keep untagged color interpretation separate:
known synthetic colors get separately hashed tagged derivative fixtures, while
original untagged files retain their own diagnostic results. The gap: native
platform guesses can differ from the generator's intended profile. The reach:
future rendering must preserve the winning timing mechanism and explicitly settle
color conversion; passing a tagged fixture cannot authorize retagging arbitrary
user footage or claim every AVFoundation composition configuration fails.

### Preserve generated duration and expose the actual joins

When: slice 18 research. Confidence: medium. Verdict: sound.

The choice: generate one word and one phrase using a five-second local reference,
then insert the complete generated PCM between untouched original samples. A
longer generated phrase lengthens the result rather than being silently squeezed
into its requested slot. Three path origins use identical reference bytes to
isolate path handling, and are explicitly not evidence of managed project reuse.
The gap: the reproduction needed concrete bounded texts, reference duration and
join treatment. The reach: generation remains a candidate until words, voice and
joins pass; seed, numerical speed and exact PCM preservation do not certify
speech quality. The agent will choose any eventual trim, stretch or fade explicitly.


### Trim removes addressed end windows rather than inventing a group envelope

When: slice 03 removal/trim. Confidence: medium. Verdict: sound.

The choice: trimming a one-second video to its middle portion also removes those
same end windows from linked audio. If that audio extends beyond the video's
original end, its extra tail remains. The agent can address that tail explicitly;
trimming one occurrence does not silently redefine the whole synchronization
group's duration. The gap: the plan defined linked project-range intersection but
left the trim command's input shape open. The reach: trim uses one occurrence and
a kept project interval, and expands through the same range-removal algebra.

Removal accepts up to 1,000 ranges in one operation, matching the batch's existing
bounded-work convention; overlapping ranges are merged before applying them.
Larger edits must be expressed deliberately within the public operation limits,
never silently divided into separate commits. This bound must appear with the
shared edit schema when the public project API is added.


### Ripple closes named time windows without silently trimming other footage

When: slice 03 ripple. Confidence: medium. Verdict: sound.

The choice: removing a half-second gap can shift later clips on named tracks even
though no picture occupied that gap. If a different clip crosses the same window,
the operation asks the agent to include it explicitly instead of silently deleting
part of it. An absent occurrence ID never becomes permission to shift unrelated
footage. Attached overlays follow their root once; fixed project overlays remain
in place and are reported for review.

The gap: the plan fixed explicit ripple scopes but left empty-time collapse and
unaddressed crossing content implicit. The reach: the agent can express global
ripple deletion by naming all affected content, or retain unrelated footage with
an explicit narrower scope. The engine does not choose which extra footage to cut.


### Move destination and retained subgroups — sound, medium confidence

When moving linked audio that begins after its video, `atUs` places the earliest
start of the expanded selection, so the audio keeps its delay. The plan required
one shared displacement but did not name which start the destination describes.
This makes multi-selection moves independent of argument order; future command
help must explain that the expanded group, not the clicked member, lands there.
For a selected move of two clips out of a four-clip link, both pairs retain their
internal synchronization. The stationary pair keeps the old group identity and
the moving pair receives a new one, so unedited members retain identity.

### Gain-only voice audition — sound, medium confidence

When generated speech sounds louder than the surrounding take, the audition
matches its average signal energy to up to two seconds of original audio on
each side. This changes only the generated samples, leaving raw generation and
original context untouched. The plan did not specify a level estimator. Silence
and delivery affect this simple measurement, so it is a reversible comparison,
not the production loudness policy. Join acceptance still requires listening.


### Change attachment without silently changing timing — sound, medium confidence

If an overlay should follow another clip, `reanchor` changes what it follows
only when the requested attachment resolves to its current start and end. The
agent uses move or retime separately when timing should change. `detach` instead
freezes that resolved position exactly, including fractional boundaries, so the
agent does not have to round it into a command timestamp. The plan required
explicit reanchoring but left its timing behavior unspecified. This separation
keeps links and source samples unchanged during a dependency-only edit, while
batches can still combine all three operations for a deliberate timing change.


### Separate join timing from acoustic similarity — sound, medium confidence

After level matching, the user still heard pauses and an echoey replacement.
The initial join audition cropped only generated margins and faded only its
edge samples, preserving surrounding original samples exactly. The later
room-tone audition declares short crossfades into original context explicitly. The crop is
explicit, not an automatic silence detector: the first word crop changed the
recognizer result from paid to page, demonstrating why quiet material cannot
be discarded solely from an ASR timestamp. A longer ending restored word
agreement. These are provisional listening candidates, not approved defaults.

For the echo complaint, a second experiment uses the same local model and
reference audio but conditions on its speaker representation alone, omitting
the reference transcript/sequence. The plan permitted local runtime experiments
but did not choose a conditioning mode. Voice similarity and room sound may
trade off. The user subsequently rejected speaker-only conditioning as much
worse; it remains negative evidence, while the original mode stays the closer
candidate. No de-reverberation claim or production policy follows from
the recognizer passing.


### Copies own their destination — sound, medium confidence

Copying an overlay alone to a later point creates an independent occurrence at
that point. It does not remain trapped inside the original parent's interval.
If the parent is copied too, the copied overlay follows that new parent instead.
The plan required duplication of occurrences and attachments but did not define
references to parents outside the copied set. This gives a copy a usable explicit
destination without changing the original attachment; agents can reanchor the
copy afterward when they want an external dependency. Duplicate defaults to the
selected subtree; linked AV copying is explicit. Its origin map shares the
`clipLineage` receipt with split/remove, which names relationships without
implying that the original was deleted.


### Match native RGB and encoder color interpretation — sound, high confidence

For the Rec.709 reproduction, RGB pixels carry the same color-space
interpretation as the encoder's output tags. The RGB color space is derived
from Core Video's Rec.709 metadata rather than assuming that a similarly named
Core Graphics space is interchangeable on this host. The plan required a
verified SDR profile but delegated the conversion mechanism. This determines
how a later native renderer must label its pixel buffers; it does not choose a
universal compression bitrate or declare untagged source color intent.


### Insertion opens time before placing media — sound, medium confidence

To insert a new video, an agent opens the desired duration on explicit tracks
with `insert`, then uses `place` for its video/audio streams in the same atomic
batch. An invalid placement rolls the whole request back. The plan required
splitting and shifting but did not prescribe whether insertion carried its own
second placement schema. Reusing place supports video-only, audio-only or
multi-layer inserts without duplicating placement rules or making users manage
partially completed edits. A gap after the final clip alone does not extend the
project; a placed clip establishes its content duration.


### Match the recorded background with a separate room-tone bed — sound, medium confidence

To address the missing hum, the audition repeats a quiet interior of an original
pause beneath the generated speech, preserving its recorded average level.
Short overlaps join repeats; short declared crossfades join the replacement to
the surrounding take. The user requested extraction and addition of the actual
background, but left the region, level and transition method to implementation.
Keeping this bed separate makes its level and source auditable and reversible.
The selected region is supported by its low stable energy and transcript gap,
not yet by an independent listening judgment that it contains no speech. These
are audition settings, not automatic defaults for all future recordings.

### Shorten only the phrase entrance — sound, medium confidence

The user accepted the phrase ending but still heard too much delay at its start.
The next audition removes 120ms from the existing voice-plus-background audio
and rebuilds just the entrance crossfade. It keeps every later sample unchanged,
so the accepted ending cannot drift through regenerated room tone or a different
mix. The amount is a reversible audition choice, not an automatic trim default;
local transcription retains the complete phrase, while naturalness still needs
listening judgment.

### Ripple move names the final destination — sound, medium confidence

When an agent moves a two-second clip from the start to ten seconds, `atUs`
means that it starts at ten seconds in the finished timeline. The old occupied
intervals close first in the timing calculation. The plan required an explicit
destination but did not choose before-removal versus after-removal coordinates.
Final coordinates make the result directly inspectable without the agent adding
back the removed duration. Separated selected clips keep their internal spacing:
only occupied old intervals close, and their whole envelope opens at the new
location. A track-only change at the same time does not open or close time.
Future convenience reorder commands must translate their chosen destination to
this same rule. Agents can compose separate moves when they want different spacing.

### Replacement retains the occurrence name but drops old content dependencies — sound, medium confidence

Replacing one narration clip keeps that clip's ID, timing and link to its video,
so later edits can keep addressing the same occurrence. The plan required explicit
occurrence selection but did not say whether replacement allocated a new ID.
Revision pinning distinguishes evidence about the old source from the new one.
An actual source or selected-range change removes the old attached descendants;
replacing with the identical selection leaves them intact. An agent can detach
an overlay first when it should survive. This avoids silently treating old
content references as references into unrelated footage while keeping the
replacement itself easy to address. Explicit trim starts at the supplied source
start; choosing a different excerpt remains the agent's decision.

### Ripple replacement follows the supplied media's natural duration — sound, high confidence

Replacing two seconds of narration with one second using explicit ripple fit
makes that occurrence one second long and shifts later audio on the named
tracks. It leaves the linked video untouched and splits the old timing link;
it does not silently speed up the video or inherit an old playback-rate change.
The plan named ripple replacement without specifying its duration basis.
Using the supplied selection's natural duration makes this fit distinct from
stretch-to-target and preserves the requested audio/video independence. A held
image has no natural duration, so it needs an explicit duration operation instead.

### Silence is an asset-free occurrence — sound, high confidence

A final three-second silent interval needs to keep those three seconds in the
project even when no later media establishes its end. It is therefore an explicit
audio clip with placement and identity, without a fake WAV file, asset ID or source
clock. The original model only described ranges and held media; explicit silence
padding exposed this missing shape. Existing media documents keep their required
asset/stream fields, and strict silence documents forbid them. Source queries
omit silence, while composition inspection retains its authored interval; a
missing recorded sample still reports its actual source with unavailable evidence.
This preserves one affine source mapping per media clip and lets ordinary clip
editing carry silence without a separate within-clip segment model.

### Padding expands into ordinary linked pieces — sound, medium confidence

If one second of replacement narration must occupy a two-second slot, silence
fit creates a one-second media prefix plus a one-second asset-free silence tail.
Video hold fit similarly adds a held-frame tail at the last selected microsecond.
The prefix keeps the old occurrence ID; lineage names both pieces, and the tail
joins the existing synchronization group or a new group with the prefix. Thus
normal linked edits carry the complete replacement, while selected scope can
change one piece. The plan named fitting policies without specifying this shape.
Ordinary pieces preserve the one-source-clock-per-clip rule and reuse all edit
primitives. Expansion removes old attached descendants, even with an unchanged
source selection; detach first to preserve a chosen overlay. Exact/default,
trim and stretch replacements keep their single-interval behavior.

## Processing routing — deterministic audio ties

- **When:** 03b routing implementation.
- **Choice:** Equal-order audio siblings use node kind and ID as deterministic
  tie-breakers. When two narration tracks share an order, reading the same project
  gives the same occurrence ordering even if its stored arrays were rearranged.
  This does not change their gain or give either voice priority.
- **Gap:** The plan required canonical audio ordering but did not name tie-breakers.
- **Reach:** Inspection and later compilation share the same resolved track rank;
  visual siblings still reject duplicate order rather than guess layering.
- **Verdict:** sound; a stable content-derived tie-break avoids storage-order drift.
- **Confidence:** high.

## Processing identity and authoring readiness

- **When:** 03c stack lifecycle.
- **Choice:** Processor IDs are unique across a project, and copy receipts record
  each original step → new step relationship. Splitting a clip keeps the old IDs
  on its retained first piece and allocates different IDs for additional pieces.
  An agent can therefore change one fragment without changing its neighbor.
- **Gap:** The plan required stable/fresh IDs and lineage without fixing their
  uniqueness scope or receipt shape.
- **Reach:** Inspection and prepared-result dependencies can identify a step
  unambiguously; copied settings never become a hidden shared configuration.
- **Verdict:** sound; follows existing transaction identity allocation.
- **Confidence:** high.

- **When:** 03c registry foundation.
- **Choice:** Constant gain uses a finite nonnegative linear multiplier, including
  zero for silence, with no automatic upper clipping limit. The registry reports
  authoring support separately from executable support. An agent can inspect a
  valid authored stack without being told that audio processing already works.
- **Gap:** The plan delegated the registry representation, and required explicit
  gain rather than hidden normalization; this fixes its initial numeric domain.
- **Reach:** Native mixing will apply these values and report peaks rather than
  silently attenuate the mix. Decibel conveniences convert at the shared boundary.
- **Verdict:** sound; consistent with the existing linear-gain contract.
- **Confidence:** high.

## Durable project request and asset ownership

- **When:** 04 core store checkpoint.
- **Choice:** A request ID is unique across mutation kinds within one project;
  creation requests have their own catalog-wide namespace. Reusing an edit ID
  for undo therefore conflicts instead of accidentally replaying another action.
  Validated arguments are compared with sorted object keys while preserving list
  order, so reordered JSON fields replay but reordered processing steps do not.
- **Gap:** The transaction contract required replay/conflict without fixing the
  namespace across operation names.
- **Reach:** CLI and MCP will share exact receipts, including labels and copied
  processing IDs. Failed requests publish no receipt and can be corrected/retried.
- **Verdict:** sound; fewer ambiguous retry cases than operation-local ID reuse.
- **Confidence:** high.

- **When:** 04 core store checkpoint.
- **Choice:** Every immutable revision directly retains its media dependencies.
  Removing a clip from today's edit does not free the media still needed by undo.
  Project deletion must explicitly retire those references in its lifecycle pass.
- **Gap:** The plan required historical retention but left the concrete owner key
  open. Revisions use globally unique IDs because asset reference owners have one ID.
- **Reach:** Undo, old previews and later portable packages can follow one owner
  graph instead of reconstructing what prior edits used.
- **Verdict:** sound; ownership matches immutable revision lifetime.
- **Confidence:** high.
## Compiler scheduling pass — 2026-09-27

- **Sound; medium confidence — Build once, query many windows.** When an agent
  requests several previews from one revision, `createCompiler` builds an interval
  index once and reuses it for frame, audio and processing queries. The plan named
  a compile-window function but left index lifetime unspecified. A caller rebuilding
  for every frame would repeatedly scan the whole project. The service must retain
  this compiler with its immutable revision; execution and cache identity remain
  separate unfinished compiler work.
- **Sound; high confidence — Keep the full audio mapping beside bounded output.**
  A preview starting halfway through speech receives only its requested sample
  interval, but keeps the clip's original source selection and placement. Replacing
  those with the preview bounds would restart stretch or resample timing. The plan
  fixed phase preservation but left worker record shape open. Future preparation
  consumes the original mapping and restricts its output, rather than treating a
  preview as newly authored media.
- **Sound; medium confidence — Omit inactive processing branches.** A short preview
  returns the clips contributing audio or sampled pictures to its window and their track/group ancestors,
  followed by output. Empty branches contain no signal, and the currently supported
  gain processor cannot generate one. The plan required bounded work but left graph
  pruning unspecified. A future processor that generates sound or has a tail beyond
  its input must revisit this rule before its capability is admitted.

## Compiler execution-window contract — 2026-09-27

- **Sound; medium confidence — Identify work with its complete manifest.** An agent
  asking for the same window gets the same revision, rendition, tap, source mappings
  and ordered processing requirements. These serializable values identify its work;
  storage can hash them when assigning an artifact key. The plan required dependency
  identity without choosing a hashing owner. Keeping hashing out of composition
  avoids a second algorithm that must agree with durable preparation and publication.
- **Sound; high confidence — Dry means before this target's stack.** Inspecting a
  dry group still hears its processed child tracks, and inspecting after one group
  step excludes all later group steps and every parent stack. The plan named taps
  without defining their request shape. Explicit target plus dry/after-step/processed
  selection preserves this meaning; immutable raw source evidence remains a separate
  existing read rather than an ambiguous dry option.
- **Sound; medium confidence — Native requirements stay unresolved.** A retimed
  narration window records its full selection, placement, pitch policy and required
  output count but cannot claim readiness without the actual prepared implementation.
  The compiler can validate this request now; native adoption later supplies media.
  This fills the plan's worker-binding gap without adding pretend executor identities
  or allowing inspection to silently substitute dry or unstretched audio.

## Decoded gap oracle — 2026-09-27

- **Sound; high confidence — Judge compressed black with the existing codec tolerance.**
  A correctly blank H.264 gap may decode a few channels slightly above zero. The
  old exact-byte test labeled such a gap as footage even though source timing and
  pixel inspection showed black. The corpus now applies its existing four-level
  color tolerance to every channel in a gap; timestamp/duration checks and
  rejection of colored glyph-free frames remain. This is an oracle correction,
  not a new production quality threshold or a relaxed whole-image color gate.

## Project retirement — 2026-09-27

- **Sound; medium confidence — A deleted project cannot replay a successful edit.**
  A retry against a retired project returns NOT_FOUND before looking up an old
  edit receipt. For live projects, replay still precedes stale-head checks.
  Returning an edit success after deletion would suggest that work remains
  available. Retrying the original creation returns its historical receipt but
  never recreates the project; the caller can inspect its availability.
- **Sound; high confidence — Keep retirement identity, release media references.**
  The existing deletion timestamp fences work; retained revision rows journal
  incomplete cleanup. After the shared queue drains, undo and revision rows retire
  in bounded pages. Project/request identities remain so retries cannot resurrect
  work. Deleting a project does not delete its original assets. Future preview or
  export owners must join this same coordinator before they can publish jobs.
- **Sound; high confidence — Deletion is idempotent by project ID.**
  Repeating project.delete for an already absent project succeeds, matching the
  existing recording deletion contract. There is no extra deletion-request ledger
  or parallel job queue.

## Compiler presentation-interval conformance — 2026-09-27

- **Sound; high confidence — A partial preview keeps the picture already on screen.**
  If a preview begins at 50,001 microseconds between project frames, its first picture
  still comes from the preceding sampled frame; only that picture's visible interval
  is shortened. The frozen render reproduction already requires this. The first
  compiler pass incorrectly kept only samples starting inside the window. Records
  now distinguish the original sample time from the clipped presentation interval,
  and dependency selection includes the preceding picture's clip even after that
  clip's authored interval ends. This is a preservation correction, not a new preview
  policy; later native execution must preserve both fields.

- **Sound; high confidence — Missing parent support outranks missing source support.**
  Two clips can read the same gapped file, but one can additionally depend on an
  unavailable attached parent. The resolver now retains the parent's exact support
  before intersecting it with the child's source. Compiled frame layers distinguish
  available, source-unavailable and anchor-unavailable, prioritizing the ancestor.
  This fills a boundary-information gap: a native decoder may prove that a source
  gap is an explicit empty edit, but that proof cannot repair missing parent support.
  The initial native executor refused ancestor gaps outright. The acquisition-gap
  picture pass below completes that path: physical selection remains validated,
  then either known exclusion suppresses the layer while preserving its reason.
  Unknown availability states and unsupported physical timestamps still fail.

## Derived-file ownership — 2026-09-27

- **Sound; high confidence — One cache, explicit domain ownership.**
  A cached preview belongs to a typed project/asset/recording owner, independently
  of its file identity. The cache validates availability through its caller's domain
  policy at reservation, publication and read, using the shared job-owner identity
  encoding. This replaces recording-only lookup without duplicating leases,
  publication or eviction. A project and asset with the same ID cannot purge each
  other's files. The recording policy remains only while that real consumer exists.
- **Sound; high confidence — Refuse the previous unshipped catalog format.**
  The derived-cache row now stores owner kind/ID rather than a recording foreign
  key. The existing format gate advances and refuses older databases without
  changing their bytes; it does not migrate or reset the user's installed library.
  This follows the agreed fresh-library cutover and keeps one writable catalog.
## Selected resampling context — 2026-09-27

- **Sound; high confidence — Resampling context comes from current retained media.**
  Splitting a continuous clip must keep the same samples, but removing source material
  must prevent that material from entering a resampling filter. Reading a fixed margin
  from the whole asset preserved split phase experimentally but leaked an excluded
  impulse into kept output, contrary to the frozen reader's selection contract.
  The compiler now derives maximal adjacent same-track/source/affine-clock runs,
  bounded by source and ancestor availability. Their exact source bounds travel with
  compiled audio. Pure splits leave the retained union unchanged; real cuts shrink it.
  These are derived execution inputs, not authored continuity groups or persistent IDs.
  Native execution may pad synthetically outside a domain, but may not feed real
  neighboring samples into the filter. Post-resampling gain changes do not split a run.

- **Sound; high confidence — The compiler supplies the retained output origin.**
  Each context pairs exact source bounds with the full run's floored output sample
  bounds at the requested rate. Native resampling can preserve frozen nearest-source
  selection without reconstructing project origins across fractional offsets,
  splits or windows. This pins phase metadata, not decoded-media equivalence.

## Project derivative retirement — 2026-09-27

- **Sound; high confidence — A held derivative keeps deletion retryable.**
  If an agent is reading a cached preview when its project is deleted, the project
  immediately refuses new reads and edits. Cleanup preserves the project's media
  references until the existing read is released and cache removal succeeds.
  A retry or startup recovery completes the same deletion; no polling janitor or
  second lifetime journal is added. The plan required owner coordination but left
  the busy-read response unspecified. This reuses the cache's existing lease refusal
  and project tombstone, keeping later preview/export delivery responsible for
  revoking its own reads before final retirement.

## Render lifetime — 2026-09-27

- **Sound; high confidence — Share attempt ownership without translating edits.**
  When a project preview renders independent audio and video, its action will run
  inside the same locked temporary directory and cleanup boundary as recording
  previews. The action interprets the compiler's records; it does not turn them
  into old recording spans. The plan required reuse but left that seam unspecified.
  Separating the render action keeps cancellation, child-process lifetime and
  publication fencing in one owner while allowing the old recording interpreter
  to be removed at cutover.

## Native video execution — 2026-09-27

- **Sound; high confidence — Stream compiled pictures under an explicit profile.**
  The service supplies retained source bindings and a sealed frame-record file;
  native reads one record at a time. A ten-minute movie does not require a whole
  frame schedule in native memory or a second interpretation of editing commands.
  The initial video profile is opaque H.264/Rec.709 using the reproduced encoder
  settings. Declared HDR, wide-gamut and custom profiles refuse until an explicit
  conversion is validated, rather than silently changing their appearance. The
  plan delegated mechanisms but required measured fidelity; this binds the first
  executable profile without claiming broader color or codec-quality acceptance.
- **Sound; high confidence — Native cancellation and worker death have different owners.**
  Cooperative cancellation removes the worker's staging before returning. A killed
  process cannot run cleanup, so the service's existing locked attempt directory
  remains responsible for that recovery. The first native operation does not add a
  competing janitor. Public preview must use this shared lifetime to retain the
  same guarantees after process death.

## Shared PCM mux input — 2026-09-27

- **Sound; high confidence — PCM consumption is the shared assembly boundary.**
  Recording and composition producers expose their format and bounded asynchronous
  blocks through `AudioPCMSource`. MovieMux remains the sole H.264-copy/AAC clock
  and assembly owner. The protocol does not carry recording roles, source paths,
  editorial plans or publication metadata; producers retain those responsibilities.
  Composition adoption requires no legacy timeline translation or intermediate WAV.

## Native audio phase and bounded raster reuse — 2026-09-27

- **Sound; high confidence — Keep selected samples and exact project sample counts.**
  A fractional cut uses the frozen decoder's nearest source start and upward-rounded
  source end, while its project output uses the compiler's absolute sample bounds.
  Those two clocks can leave a final output sample without a retained input sample.
  Only that calculated deficit may receive synthetic zero, and only after the
  decoder reaches the declared selection end; discarded real audio never fills it.
  This resolves the endpoint policy left open by the plan without changing duration,
  adding a gain ramp or weakening pure-split/window identity. The shared conversion
  owner applies this same bounded endpoint rule to recording and composition audio;
  genuinely truncated retained input still fails.
- **Sound; high confidence — Reuse an unchanged picture within one render attempt.**
  A held picture may occupy thousands of output frames. Retaining one immutable
  rendered buffer avoids drawing the identical picture repeatedly, while every
  compiled frame keeps its own timestamp and duration. Reader identity, selected
  source-sample time and background state distinguish reuse; future image-changing
  processing must extend that identity or disable reuse. This is bounded temporary
  memory inside the existing buffer limit, not another persistent cache.
- **Sound; medium confidence — Bound the initial native audio admission explicitly.**
  The first PCM worker admits at most 256 clip records and 10,000 processing nodes
  per requested window, with an 8 MiB processing-buffer ceiling. Unsupported larger
  windows refuse before execution instead of allocating an unbounded tree. These
  are provisional worker limits, not project authoring limits or completion of the
  long-project contract; slice 24 must resolve scalable streaming before release.


## Public composition preview and movie assembly — 2026-09-27

- **Sound; medium confidence — Budget a render from the retained movie duration.**
  Previewing the last second of a long source seeks to that retained interval.
  Its worker budget includes startup plus two times the selected duration, for
  picture rendering and PCM/AAC assembly, capped by the shared media limit. The
  plan did not specify this formula. Charging for a discarded source prefix would
  hide stalled short previews. Broader throughput remains a separate scale gate.
- **Sound; high confidence — Pin the whole preview request before starting work.**
  Asking for a preview without a revision or range resolves both from the current
  project once. Later edits cannot move that job's target. The implementation
  identity joins its cache identity, so changed rendering code cannot silently
  reuse a differently produced result. The initial profile is the measured opaque
  H.264/Rec.709 profile at the authored canvas; no unverified rendition choices
  are exposed. Future profiles must retain explicit identity and fidelity gates.
- **Sound; high confidence — Delivery ends at deletion; existing reads still drain.**
  Deleting a project immediately invalidates its preview tokens. A read already
  holding a cache lease can finish, so deletion may need retry before removing
  derived files and history references. Revoking another project's tokens or
  removing files beneath active reads would violate ownership. The shared delivery
  and cache owners enforce this without a second project-specific token store.
- **Sound; high confidence — Keep movie time and PCM sample time explicit.**
  A requested window starts movie playback at zero, so its PCM block positions
  are relative to that window. Source context and unavailable-range evidence
  retain absolute project positions, allowing an agent to locate the original
  issue. A positive one-microsecond movie may contain no audio sample and therefore
  no audio track. Exact MP4 movie/edit-list durations remain authoritative when a
  probe rounds AAC duration to sample boundaries; no selected PCM sample is dropped
  merely to make those two reports look identical. This resolves the assembly
  boundary without inventing sound or changing the requested timeline.


## Shared project export lifecycle — 2026-09-27

- **Sound; medium confidence — Pin rendered bytes independently of renderer availability.**
  An export that already selected a completed preview can still publish those exact
  bytes after the rendering implementation is unavailable. If cache eviction removes
  those bytes, regenerating requires the originally pinned implementation; another
  build may produce a different movie. The plan required repeatable outputs but did
  not specify this deployment boundary. Missing implementation is recoverable when
  it returns. Explicit export retry repairs only that matching current preview
  failure; an unrelated newer decode failure still requires its own diagnosis.
- **Sound; high confidence — One export owner accepts explicit recording or project domains.**
  Exporting either kind writes a typed owner identity in the same intent table and
  uses the same job, cache and publication lifecycle. A project-only service supplies
  its real project owners, not fabricated recording stores. The changed unshipped
  table uses catalog format 4 and refuses previous formats; it never migrates or
  resets them. This resolves the unspecified reuse seam while preserving the fresh
  library decision and enables removing recording bindings at cutover.
- **Sound; high confidence — Discovery cursors name both possible owner filters.**
  When an agent carries a page cursor between CLI and MCP, it carries explicit
  recording and project fields, with the unused one null. Reusing it with different
  filters fails instead of silently traversing another set. The plan did not fix
  cursor shape; one neutral shape avoids separate export discovery implementations
  and leaves no fallback for obsolete unshipped cursor forms.
- **Sound; high confidence — Stop export admission before waiting for service requests.**
  A destination check may still be running when the service shuts down. The export
  owner first closes admission and sends cancellation, then the service waits for
  pending requests and owners before closing storage. Waiting first would delay the
  very signal needed to end the request and could admit new work during shutdown.
  The existing export lifetime supplies this signal; no additional shutdown owner
  or timeout is introduced.


## Exact source-range projection — 2026-09-27

- **Sound; high confidence — A retained word belongs to one clip occurrence.**
  Splitting through a word produces two partial results with complementary exact
  ranges; their separate clip identities are not fused into a fictitious whole
  word. An internal source or anchor gap also makes the result partial, even if
  the outer endpoints survive. This fixes the completeness meaning left open by
  the range API. Later phrase search can recognize declared contiguous whole-word
  sequences but cannot silently upgrade partial words.
- **Sound; high confidence — Empty retained coverage has no word occurrence.**
  Querying a known clip for a wholly removed or unavailable source interval returns
  no retained word (`null` for named lookup, omitted from all-occurrence lookup).
  A surviving fragment returns partial evidence. The plan did not choose an empty
  shape; this keeps absent audio from appearing as spoken words. Public inspection
  must still report unavailable/acquisition ranges through its separate source
  evidence, rather than treating missing words as proof of silence.


## Acquisition-bound composition — 2026-09-27

- **Sound; medium confidence — Changing capture context replaces source identity.**
  If a clip switches from a context that excludes a capture gap to one that includes
  it, content attached to the old source selection follows the existing replacement
  removal rules. Keeping those attachments silently could make annotations refer to
  different retained material. The plan specified replacement binding but left this
  attachment consequence open; processing keep/reset remains independent.
- **Sound; high confidence — A capture context may describe unused sibling streams.**
  A capture containing screen video and microphone audio keeps both bindings even
  when a project uses only the microphone. Validation requires the selected binding
  to match loaded media, without requiring unused sibling assets in every project
  model. This resolves the scope of context validation and preserves provenance
  without expanding every revision's media dependencies.
- **Sound; high confidence — Captured support constrains rather than guarantees bytes.**
  If a journal says audio was acquired beyond a file's physical endpoint, the model
  uses only the intersection. It does not reject the complete context or invent
  missing samples. The plan required physical/support intersection but did not fix
  treatment of a broader journal interval; keeping it preserves raw evidence while
  ensuring playback and inspection use only available media.


## Native source selection — 2026-09-27

- **Sound; high confidence — PCM results describe sources; capture receipts describe roles.**
  Reading an imported stream produces the same PCM report as reading a recorded
  microphone track, without calling imported audio narration. Recording receipt
  writers attach their actual microphone/system role. This resolves the shared
  report boundary left open by the neutral selection contract and keeps one
  converter available to transcription and subsequent audio inspection.
- **Sound; high confidence — Ambiguous stream omission is an invalid request.**
  A file containing two audio streams requires the caller to choose one. Omission
  returns INVALID_REQUEST; a named stream that cannot decode retains the existing
  decode failure. The spec fixed refusal but not its error category. Neither file
  ordering nor a decoder default becomes the agent's editorial choice.
- **Sound; high confidence — Compiled exclusions may suppress occupied pictures.**
  A capture context can exclude a picture whose bytes still exist in the file.
  Native video validates the selected stream and source instant, then respects the
  compiler's unavailable verdict. It does not alter the shared decoder, so another
  occurrence can retain that same picture. This resolves the negative-support
  trust boundary; unknown states or unsupported source timestamps still refuse.


## Capture adoption admission — 2026-09-27

- **Sound; medium confidence — Identical role files share a binding only when support agrees.**
  A capture may contain identical microphone and system files. Byte deduplication
  then gives them the same asset and stream IDs. If both histories acquired the
  same intervals, one binding retains both authentic role labels. If they acquired
  different intervals, adoption refuses: selecting that context/asset/stream could
  not identify which history the agent intended. The plan fixed selector identity
  but left this collision unspecified; silently taking the first or unioning masks
  would erase the requested distinction.
- **Sound; medium confidence — A failed capture adoption does not delete valid media assets.**
  The video may finish importing before an ambiguous audio stream makes adoption
  fail. The incomplete capture context stays unavailable and its references are
  released, but independently valid immutable assets remain in the library. Deleting
  those assets as rollback could delete bytes another project already uses. The
  plan did not specify visibility of successful member imports after a later failure;
  the existing asset owner continues to govern those bytes and future storage policy.
- **Sound; high confidence — Capture metadata can be read without constructing an importer.**
  Reopening a project needs its selected capture support and lifetime references;
  it does not need a native worker or journal-copy machinery. The metadata store
  and import executor have separate responsibilities in one acquisition module.
  They share the catalog and existing evidence/asset/job owners, rather than adding
  another parser or queue. This resolves the constructor boundary while keeping
  ordinary revision reads independent of media preparation.
- **Sound; high confidence — Recover abandoned imports before constructing the queue.**
  The shared queue resumes durable queued jobs as soon as it is constructed. Under
  the exclusive service lock, startup therefore removes abandoned acquisition files,
  indexed generations and references first. Reversing that order could erase the
  files a resumed import just created. The plan required recovery but did not fix
  this initialization order; the actual crash journey checks all three kinds of
  abandoned state before permitting retry.

## Source transcript storage — 2026-09-27

- **Sound; high confidence — Recording packages retain their actual domain metadata.**
  The shared transcript store now indexes either a recording or an imported asset,
  with explicit source descriptors. Existing recording package readers receive a
  checked recording view with their real narration provenance; an asset transcript
  cannot pass that conversion. The plan required preserving packages but left this
  boundary representation open. It keeps one raw ingester and bounded index without
  pretending an arbitrary imported stream belongs to a recording. Managed project
  packages will adopt their own explicit source dependencies in slice 22.
- **Sound; high confidence — Source support hashes supplement source identities.**
  Two contexts may retain the same samples but have different capture provenance.
  Source preparation therefore keeps the selected asset, stream and acquisition
  identity alongside a digest of the effective support. It never replaces those
  identifiers with the digest alone. This determines the compact preparation-input
  shape without storing large interval arrays in job keys; raw evidence remains
  separately pinned and immutable.


## Selected source transcript integration — 2026-09-27

- **Sound; medium confidence — Source phrase searches stop at transcript segments.**
  A capture gap can leave two recognized words adjacent in stored row order even
  though they were never spoken continuously. Searching the source will not join
  words across inference segments. The plan requires acquisition-gap separation
  but leaves the exact search boundary representation open. Segment identity is
  already retained by the single ingester; edited cross-clip phrases remain the
  separate project query contract, where playback continuity is explicitly known.
- **Sound; high confidence — Job dependencies commit with the actual job identity.**
  Preparing imported speech must retain both its media and selected capture context.
  Queue admission now provides a synchronous callback after assigning the real job
  ID, inside the same catalog transaction, including repeated admission. If saving
  a reference fails, the job and its references roll back together. The plan required
  the shared lifetime ledger without choosing this transaction seam; inventing a
  second dependency identity would make cleanup unable to follow the real job.
- **Sound; high confidence — The final canceled model caller waits for cleanup.**
  When service shutdown cancels the only model download, its preparation promise
  now settles after temporary-file cleanup. Otherwise a caller awaiting shutdown
  could release library ownership while the old downloader still writes there.
  A caller leaving a download that another caller still needs returns promptly.
  The plan did not specify cancellation settlement timing; this makes awaiting the
  owner meaningful without introducing another shutdown owner or polling loop.


## Bounded source and occurrence seeks — 2026-09-27

- **Sound; high confidence — Portable admission establishes the same word ordering invariant.**
  A late transcript window used to scan backward by the longest word anywhere in
  the source. A long early word could therefore make a late request read thousands
  of irrelevant rows. Source ingestion already prevents overlapping words; portable
  package admission now enforces that same property, including page boundaries.
  Both readers can then seek just one earlier word and the rows in the window.
  The plan required bounded work but did not select this invariant-based seek;
  metadata and cursor formats stay unchanged.
- **Sound; high confidence — Select occurrence envelopes before filtering available fragments.**
  A query entirely inside a capture hole still identifies the clip and selected
  capture context, with an empty list of available fragments. Dropping that clip
  would hide why evidence is missing and could join speech across the hole.
  Composition therefore owns indexed envelope selection and exact inverse mapping;
  core can represent unavailability without reconstructing timeline arithmetic.
  The plan fixed gap-aware phrase matching but left this selection representation
  open. Full-word projection remains separate so query clipping cannot change
  whether an edit retained the whole word.


## Native source WAV delivery — 2026-09-27

- **Sound; medium confidence — Classic float-WAV capacity is explicit.**
  A long full-source request can exceed the format's 32-bit container sizes. The
  shared sink now refuses payloads above UInt32.max minus a 4096-byte platform
  header reserve before creating output, rather than discovering overflow after
  hours of decoding. The spec left the supported large-file container open; RF64
  or another large-file format is not implemented. This conservative limit remains
  a release-format decision for slice 24, not a claim of unlimited WAV duration.
- **Sound; high confidence — Source windows use an absolute sample clock.**
  Asking for a later portion of a source must select the same samples as slicing
  its full WAV. Window endpoints therefore use the existing composition floor
  clock and retain each support run's decoding origin. The established recording
  operation concatenates spans with its own preserved clock and join treatment;
  it is not reused as a synthetic one-span source window. This resolves the source
  producer seam while retaining measured recording/ASR behavior.
- **Sound; high confidence — Preserve known native formats and refuse ambiguous layouts.**
  Raw source delivery retains integral native sample rates and conventional mono
  or stereo, with platform defaults when channel-layout metadata is absent.
  Explicit discrete stereo, wider layouts and fractional rates refuse instead of
  silently remapping or rounding. The plan required supported-layout preservation
  without choosing the initial format set; extending that set needs real channel
  and sample-parity proof through the same producer.


## Project transcript and source audio ownership

- **Sound; medium confidence — Query checkpoints are disposable cached evidence.**
  When an agent reads a long project one page at a time, the service saves its
  source-generation pins and merge position in the existing derived-file cache.
  If those files disappear, the old continuation refuses and the agent starts a
  fresh read; it never silently resumes against different words. The plan required
  bounded pinned reads but left their representation open. This avoids a permanent
  read-session database; future inspection must preserve explicit invalidation.
  Landed in the core paging/public routing pass.

- **Sound; medium confidence — Keep a small revision context in memory.**
  Consecutive pages reuse validated clip indexes for up to four recent revisions
  instead of parsing the whole project again per page. Project existence and
  evidence generations are still checked. The plan left this memory/performance
  tradeoff open. The source/occurrence and serialized-checkpoint limits are
  provisional scale gates; exceeding them refuses explicitly, and slice 24 must
  judge realistic long projects. Landed in the core paging pass.

- **Sound; high confidence — Retrying project evidence does not retry every source.**
  A failed query can refer to many source recordings with different problems.
  Project retry rebuilds its own manifest; a failed source is retried using the
  returned source selection after diagnosis. The plan did not specify retry
  fanout. This keeps expensive transcription intentional and makes dependency
  failures visible. Paging cursors and limits are not accepted on this mutation.
  Landed in the public routing pass.

- **Sound; high confidence — Selected-source WAVs have an asset-domain owner.**
  Extracting audio from an imported file retains that asset and its optional
  acquisition context through the shared job/cache system. It does not manufacture
  a recording or edit revision. The existing recording audio owner depends on
  recording timelines, so the source owner is separate until consumer cutover.
  The plan fixed role-free source semantics but left that implementation split
  open. Project taps must join shared processing, and job-reference retirement
  remains an explicit cutover requirement. Landed in the core source WAV pass.


## Full source WAV delivery

- **Sound; medium confidence — Bound published cache bytes at the supported WAV ceiling.**
  A long stereo extraction can exceed the former one-GiB cache despite fitting the
  native WAV format. The shared default is now four GiB, and the audio owner checks
  its known minimum size before rendering. The plan required full extraction but
  left the cache budget unspecified. Existing leases still protect active readers;
  insufficient free space can fail at publication, and in-progress files are outside
  this published-byte budget. Custom smaller budgets remain possible. This changes
  retained disk use, not per-read memory. Landed in the shared capacity pass.

- **Sound; medium confidence — Preflight uses the minimum WAV size, not a copied native header rule.**
  For a known rate and channel count, exact absolute sample boundaries determine
  PCM bytes. The check adds the smallest RIFF header; it does not claim to predict
  every encoder chunk. The plan did not define preflight precision. This prevents
  certainly oversized work without falsely refusing valid files; final publication
  checks actual size. The native writer independently owns its format ceiling.
  Landed in the shared capacity pass.

- **Sound; high confidence — Large MCP audio remains an artifact instead of an inline message.**
  A full recording can produce a gigabyte WAV. CLI streams it to disk; MCP returns
  its existing renewable delivery token once audio exceeds the bounded inline size.
  Small excerpts retain inline audio. The plan specified full delivery but not MCP
  representation. This lets agents inspect bounded chunks or download the file
  without allocating a gigabyte message. The same artifact read/renew/close protocol
  already serves previews. Landed in the public source audio pass.

- **Sound; medium confidence — Source extraction deadlines scale with selected output duration.**
  A short late excerpt gets startup allowance plus twice its requested duration,
  rather than a budget based on the discarded prefix. Full extraction receives a
  longer but finite deadline, capped by the existing worker timer limit. The plan
  left this scheduling parameter open. This matches the existing movie execution
  policy; slice 24 still owns empirical long-work and no-progress acceptance.
  Landed in the public source audio pass.


## Edited phrase query decisions

- **Sound; high confidence — Sort a phrase by its first word, even if another speaker finishes sooner.**
  Two tracks may speak at different speeds. Search finds each track's next match
  independently, then merges matches by the first contributing word's exact project
  time. The plan fixed project ordering but not this mechanism; emitting a phrase
  as soon as its last word arrives would put a later, faster speaker first. Bounded
  checkpoints may therefore return an empty page while an earlier track is scanned.
  Landed in the core/public phrase pass.

- **Sound; medium confidence — Preserve literal search text in continuation identity.**
  Matching ignores case and outer punctuation, but a continuation still names the
  exact submitted query. Changing “Okay so” to “Okay SO” requires a new read even
  though their matches agree. The plan left normalized-versus-literal query identity
  open. This matches source search and avoids implicit query changes across pages;
  optional retry text selects that same phrase manifest. Landed in the phrase pass.

- **Sound; high confidence — Inspection windows retain recoverable word boundaries.**
  Looking at a narrow interval inside a whole word returns that word's full retained
  editorial fragments, rather than shortening it to the inspection window. A word
  actually trimmed by the edit remains partial. The plan specified editorial
  partiality but left fragment clipping ambiguous; keeping full word boundaries
  makes transcript evidence useful for subsequent edits. Synthetic missing-support
  gaps still describe the selected window because they have no original word row.
  Landed in public paging and clarified in contracts during phrase integration.

## Capture and audio integration decisions

- **Sound; medium confidence — Missing event categories are explicit, not fabricated.**
  A project can currently return captured pauses and geometry while reporting that
  scene, cut and interruption evidence is unsupported. An agent must not interpret
  this as proof that none occurred. The plan left category rollout unspecified;
  the remaining categories stay required work before occurrence-query closure.

- **Sound; high confidence — Audio encoder staging uses the existing render lock.**
  If the service crashes while a native encoder is still writing, the child keeps
  the inherited workspace lock. A restarted service cannot clear that child's
  files; after it exits, ordinary workspace cleanup removes the whole attempt.
  Only completed WAV bytes are copied exclusively into the cache. The plan left
  native temporary-file lifetime unspecified. Reusing this owner avoids a second
  cache janitor with knowledge of private encoder filenames.

- **Sound; high confidence — Audio-only requests bind only audible dependencies.**
  Inspecting a track should not fail because an unrelated picture processor is
  unavailable. Audio windows use the compiler's shared planning and source-binding
  owners but select the audio plane. Generic movie windows retain both planes.
  The plan required shared binding without specifying this separation; later
  processors must preserve it rather than introducing another mixer.

- **Sound; high confidence — A demanded picture ignores unrelated audio execution.**
  A still from a project with retimed speech uses the same globally phased picture
  as a movie, but does not need the audio stretch processor to be ready. The plan
  required shared capability binding; extending its existing media-plane selection
  keeps picture and audio inspection independent without duplicating timing.
  Landed in the direct-picture planning prerequisite.

- **Sound; medium confidence — A demanded frame is a one-microsecond query on the global picture schedule.**
  Asking at 75,001 microseconds in a 20-fps project selects the picture sampled at
  50,000 microseconds. The receipt distinguishes that earlier sample from the
  requested visible interval, 75,001–75,002. The plan required global timing but
  left point-query representation open. This lets stills reuse exact movie
  scheduling without creating a second nearest-frame rule.

## Native media execution decisions

- **Sound; medium confidence — AAC comparisons permit bounded seek-dependent float differences.**
  The same old decoder produces slightly different floating samples when reading
  an AAC file from the beginning versus seeking near its end; packet-aligned
  retries do not remove that difference. The native output is not changed.
  Comparison now requires exact counts, clocks, channels and endpoint samples,
  plus both RMS and maximum error below one 16-bit quantization step. Lossless
  formats and unchanged successful old/new ranged output stay byte exact.
  This corrects an overbroad test contract based on retained negative controls;
  it does not excuse missing samples or establish perceptual quality.
  Evidence: [AAC comparison audit](assets/11a-audio-extraction/README.md).

- **Sound; medium confidence — Decoder lookbehind is bounded by declared packet size.**
  A seek inside the last compressed packet can miss real samples. The shared
  reader includes two packet widths before the selected time and discards that
  context before conversion. It may reopen once after real progress at the exact
  next unread sample, then refuses another shortage. Unknown or oversized packet
  metadata refuses; signed requested starts must never be advanced to zero.
  The plan left recovery mechanics unspecified. Broader format admission and
  resource limits remain slice-24 work; this is not a universal codec guarantee.

- **Sound; high confidence — Execution revisions are separate from portable transcript format.**
  Replacing the native decoder changes new audio, movie and transcription job
  identities. A saved transcript remains readable under its existing format and
  generation; changing the format version merely to force fresh inference would
  break retained packages. The plan left this invalidation seam unspecified.
  New current work uses the revised execution key while old retained artifacts
  keep their provenance. Evidence: [execution pins](assets/11a-audio-execution-pins/README.md).

- **Sound; high confidence — Still receipts distinguish requested pictures from physical samples.**
  The compiler may request a time inside a source picture. The receipt keeps the
  requested time and exact native sample value/timescale/origin, with a separately
  rounded convenience timestamp. It distinguishes an empty canvas, excluded
  acquisition support and an actual empty media edit. The plan required traceable
  timing but left the native representation open; retaining both clocks prevents
  a rounded label from becoming a false exact boundary.

- **Sound; high confidence — Still delivery sizing follows the completed movie canvas.**
  The picture is oriented and composed once using the movie executor, then reduced
  to the requested image delivery size. Resizing inputs before composition would
  create a second framing path. The existing profile and image-size limits apply;
  profile color conformance remains independently verified.

- **Sound; high confidence — Concurrent renders keep shared root authority and exclusive attempt authority.**
  A movie and a still may render at once into separate child directories. Each
  child retains a shared lock on the render root and an exclusive lock on its own
  directory. Restart cleanup needs exclusive root authority, so it cannot erase
  an orphan worker's output. Attempt cleanup uses open directory descriptors,
  not a path that another operation can replace. The plan left concurrent
  temporary-file ownership open; this extends the existing render owner without
  adding a separate cleanup service. Landed in the concurrent-render pass.

- **Sound; high confidence — Visual comparison converts each image from its actual color profile.**
  A PNG and a decoded movie frame can contain the same scene but declare different
  transfer curves. Placing their raw values beside one another can manufacture a
  brightness difference. The independent reference converts the movie's actual
  embedded profile to the PNG's sRGB space before comparison. The plan required
  visual parity without specifying reference conversion; no production pixels
  or acceptance tolerances change. Broader color fidelity remains a separate gate.


## Selected-source picture decisions

- **Sound; high confidence — Source frames keep source identity without project-shaped metadata.**
  An agent inspecting the second video stream in an imported file supplies that
  asset, stream and optional capture context. The result contains the physical
  picture covering the requested source instant, including its exact start/end
  clock. It has no made-up project revision, clip, canvas or processing tap.
  Declared physical gaps and capture exclusions return distinct unavailability,
  rather than a synthetic black source image. The plan left the raw receipt and
  gap response open; this prevents absence from looking like recorded black video.
  Source and project requests share frame job/cache publication and the native
  color/orientation owner, while retaining different planning inputs. Landed in
  the selected-source picture integration.


## Retained scene ownership decisions

- **Sound; high confidence — A retained scene generation pins its selected stream and capture context.**
  The same imported file can contain two video streams or be reused with different
  capture context. A generation cannot change that selection between chunks even
  when its support happens to be identical. Owner kind prevents collisions with a
  real recording that happens to have the same ID. The plan left storage identity
  details open; the shared source descriptor keeps one duration authority and the
  queue remains responsible for declaring finished work ready.

- **Sound; high confidence — Real recording packages keep their recording metadata.**
  Opening an existing recording package still reads its established scene format.
  Only the internal retained reader uses neutral asset-or-recording identity;
  explicit conversions protect the package boundary. An imported asset is never
  disguised as a recording package. This fills the plan's storage seam without
  inventing a new portable format before editable project packaging is implemented.


## Acoustic evidence decisions

- **Sound; medium confidence — Omitted waveform resolution produces an overview.**
  Asking for a whole long recording produces roughly a thousand buckets instead
  of failing because a fine default exceeds the response limit. An agent can then
  request a narrower window with an explicit number of sample frames per bucket.
  The response reports its exact resolution and partial edge bounds. The plan
  required useful detail but left default resolution open; automatic overview
  plus explicit detail keeps the first request useful without hiding short sounds.

- **Sound; high confidence — Cached waveforms retain audio provenance without requiring temporary WAV bytes forever.**
  After measurements finish, deleting the disposable WAV does not invalidate the
  surviving waveform. Its audio recipe and generation remain pinned. Rebuilding
  missing measurements needs that audio again; explicit retry uses the same audio
  owner to recover the prerequisite, while ordinary reads do not restart terminal
  failures. This fills the dependency-lifetime seam without another scheduler or
  a second decoder.

- **Sound; high confidence — Waveform JSON uses the same leased artifact transport as pictures and audio.**
  CLI inspection writes a complete JSON file without overwriting an existing file;
  MCP supplies its bounded JSON text. Both consume the same cached bytes and close
  the delivery lease. The plan left model presentation open; text preserves exact
  numbers for agents without base64 decoding or another download mechanism.

## Continuous audio support

- **Sound; high confidence — Joining availability declarations does not join edits.**
  When capture is available from 0–1 seconds and again from 1–2 seconds, audio
  reads those declarations as one continuous interval before decoding. A gap of
  even one microsecond remains excluded, and overlapping declarations still
  refuse. The plan permitted adjacent source support but left decoder boundaries
  implicit. Only caller support is joined: physical container segment boundaries
  and recording edit joins retain their established meaning. Existing accepted
  recipes are unchanged, so this does not invalidate cached execution results.

## Capture completion and occurrence boundaries

- **Sound; high confidence — A stopped capture reports its finalized video endpoint, not an invented failure onset.**
  If the recorder finishes video at two seconds but its selected microphone stream
  ends earlier, the completion fact remains at two seconds. Short audio does not
  receive a relocated interruption marker. Older receipts that merely say a finish
  record existed remain unknown; damaged or contradictory terminal records retain
  their facts but cannot publish a trusted marker. The plan required interruption
  evidence without defining which journal fact establishes its time. Optional
  completion and last-lifecycle metadata preserve that distinction for all future
  event readers. Failure codes are retained without verbose failure messages, and
  terminal facts share the existing provenance size budget instead of being silently
  dropped. Landed in lifecycle provenance and capture-end projection.

- **Sound; high confidence — A capture-end marker belongs to the range closing at its time.**
  A query from one to two seconds includes a completion at two seconds; a query
  starting at two seconds does not repeat it. Ordinary observations keep their
  existing start-inclusive/end-exclusive rule. At an adjacent clip boundary, the
  reader briefly retains the prior clip's endpoint while merging the next clip's
  opening observations using the established project-time/track/clip ordering.
  The plan left endpoint query ownership open. This prevents dropped final markers
  and pagination reordering without changing transcript semantics; capture
  checkpoints have their own policy because their continuation state changed.

## Selected-source scene measurements

- **Sound; medium confidence — Scene sampling refuses unusually expensive batches instead of silently skipping frames.**
  A short request crossing an extreme number of physical edits or decoded samples
  has explicit work ceilings. If it exceeds them, the operation fails visibly and
  can be retried with a narrower range. These inspection limits are provisional
  for the broader scale gate; no content is mislabeled unavailable to meet them.
  The plan required bounded work but left the physical-support traversal ceiling
  unspecified. Existing frame/movie callers keep their prior decoder behavior.

- **Sound; high confidence — Selected-source scenes preserve exact picture clocks and reset across real gaps.**
  Two sampled images can have a short physical hole between them even when both
  endpoints contain pictures. The sampler checks the intervening support, so
  stillness does not run through that hole. Touching availability stays continuous.
  Exact container clocks identify images; rounded microseconds remain convenient
  labels, and stillness starts at the first observed request after a reset. The
  plan did not prescribe chunk overlap: source chunks repeat the exact previous
  endpoint and publish analysis state only after the whole batch succeeds. This
  preserves retry behavior and leaves the recording nearest-picture policy intact.

## Spectral measurements

- **Sound; high confidence — Retain physical spectral energy before choosing image contrast.**
  When inspecting hum or a quiet consonant, the measured spectrum retains separate
  channels and linear power per frequency interval, including constant/DC energy.
  It does not remove a mean or apply a display floor. The image may later choose
  a clearly labeled decibel scale. The plan left normalization and window defaults
  open; periodic Hann and explicit rectangular windows use one-sided density
  scaling, so frequency-bin energy has a defined meaning rather than arbitrary
  brightness. Bounded matrix admission limits work before reading PCM.

- **Sound; high confidence — Spectral queries keep a global sample grid and declare missing window context.**
  Narrowing a displayed range over the same audio file returns identical overlapping
  columns. If the input file itself is clipped, windows at its edges explicitly
  report missing context. A public range/full-parity promise must acquire surrounding
  PCM through the existing audio owner, respecting capture masks. The plan left
  edge-window semantics open; inventing neighboring samples would conceal missing
  evidence. No second decoder or mixer is introduced.
## Acoustic raster choices — 2026-09-28

### Sound, medium confidence — preserve short energy when compressing measurements into pixels

When many time buckets or frequency bins share one image pixel, draw the largest spectral density in that pixel. A short click or narrow tone therefore remains visible; averaging could hide it and last-value assignment could erase it. The spec requires useful bounded pictures but leaves raster reduction unspecified. This affects only display: numerical density remains unchanged. The legend says “max per pixel,” so the image cannot be mistaken for an average-energy measurement.

### Sound, medium confidence — one fixed spectral display scale and shared waveform scale

A quiet channel beside a loud channel uses the same waveform amplitude scale, with a minimum full-scale range and five percent headroom above larger peaks. It does not make both channels appear equally loud. Spectral images use a fixed -120 to 0 dB density scale (power relative to full-scale squared per Hz), preserving comparability between views; values outside it saturate only in the image, never in numerical evidence. The plan did not specify display scaling. Future appearance changes must keep scale labels explicit and keep underlying measurements intact.

### Sound, high confidence — preserve full labels outside the bounded image

A project with a very long clip identifier still produces a bounded image. The visible label ends with an explicit full-text-in-receipt notice; the native receipt retains the entire provenance string. Rejecting legitimate identifiers would prevent inspection, while silently clipping text would hide identity. The plan required provenance without choosing overflow behavior. Public artifact delivery must preserve that receipt so an agent can resolve the abbreviated label.

### Sound, high confidence — render retained measurements without another audio decode

The native plotting operation receives bounded waveform or spectral measurements and writes PNG using the existing picture encoder/publication owner. It cannot reopen audio, mix channels or choose a different revision. This introduces one internal native operation, one core request adapter, and no new package dependency. The plan required measured images but left the rendering library open; using existing macOS graphics keeps output headless and avoids introducing a second media pipeline.

## Retained source scene paging

- **Sound, medium confidence — continuation counts examined candidates.** Two
  physical samples can round to the same displayed microsecond. A range query
  examines a bounded set, keeps only samples whose exact timestamps belong, and
  continues after the last examined sample even when none belonged. This avoids
  an unbounded search hidden behind an apparently small result page. Consumers
  must follow the continuation until it is absent.
- **Sound, high confidence — index actual sample time and ordinal together.** A
  late request seeks directly to its cursor, including samples sharing the same
  rounded time, rather than revisiting every earlier chunk. Exact clock data
  remains alongside the index for range membership; displayed rounding cannot
  change whether a sample belongs.
- **Sound, high confidence — keep recording and asset evidence distinguishable.**
  Recording packages describe nearest sampled pictures; imported assets describe
  the picture physically present at the requested time. They share generation
  ownership and storage but use explicit typed chunk views. An asset cannot be
  exported accidentally through the recording package representation.


## Source scene preparation

- **Sound, high confidence — prepare a complete selected-source generation on demand.**
  An agent's first scene request queues one bounded scan of that selected stream
  and acquisition support. Later requests read the retained generation instead
  of decoding overlapping windows again. Chunking bounds each worker step; the
  existing heavy-work queue limits concurrent execution. Merely importing an
  asset does not introduce a second automatic scene scheduler.
- **Sound, high confidence — keep ordinary cancellation distinct from deletion.**
  Canceling inspection lets the agent explicitly retry later. Deleting its owner
  drains the worker and permanently cancels that job under the existing queue
  policy. A late successful worker result cannot revive deleted work. The same
  resource-reference and queue owners enforce both cases.

## Acoustic delivery and surrounding context

- **Sound; medium confidence — Spectrograms begin with a bounded local view.**
  A long recording first gets a waveform overview; a spectrogram uses a short
  selected window, with explicit FFT and hop sizes for frequency/time resolution.
  Excessive detail refuses with a limit instead of silently discarding columns.
  The plan left public defaults open; this keeps a request inspectable and makes
  the resolution visible. Waveforms offer JSON or images; the separate spectrogram
  operation shares their preparation and delivery owners.

- **Sound; high confidence — Image preparation depends on measurements, not resident audio bytes.**
  If a temporary WAV has been evicted, an existing waveform or spectral measurement
  can still produce its image. An existing image also survives measurement eviction.
  When rebuilding needs missing inputs, explicit retry follows the same dependency
  chain; ordinary reads do not restart canceled work. The plan left multistage cache
  lifetime open. This preserves useful evidence without pinning large WAV files.

- **Sound; high confidence — The displayed interval and FFT context remain distinct.**
  An image of a word can require a few neighboring samples to measure frequencies.
  Those samples use the same source masks and processing tap, but their exclusions
  are reported separately. If a neighboring exclusion affects a column, the image
  warns that its analysis is incomplete even when the displayed interval has audio.
  The plan required full/range parity without specifying this annotation; context
  cannot masquerade as measured silence or silently widen the agent's chosen range.

- **Sound; high confidence — Large bounded measurements use the existing render attempt's files.**
  A valid spectrogram can exceed the worker's small command-message limit. The
  service writes its measurements inside the same locked temporary directory used
  for rendering and sends the path. The worker reads only a bounded regular file;
  cleanup removes it with the attempt. This fills the transport seam without
  raising global command limits or adding a second file-lifetime mechanism.

## Scene inspection and occurrence projection

- **Sound, medium confidence — preserve measured coverage context around a query.**
  Asking about the middle of a still picture returns its retained observation
  chunk, including the earlier measured stillness start. It does not claim the
  stillness began when the agent asked, and it does not turn an unsampled gap
  into known unchanged pixels. Sparse observations and physical source support
  remain distinguishable.
- **Sound, high confidence — physical scenes carry physical clocks, not invented capture events.**
  Imported footage can have scene changes without any capture journal. Those
  rows keep exact source sample time and their own ordinal; capture pause and
  interruption rows keep their existing capture fields. One event merge projects
  both through each clip occurrence and orders them by exact time.
- **Sound, high confidence — event continuations carry both reader positions.**
  A pause and a picture change can alternate across one-row pages. The cursor
  keeps each reader's consumed position, and the project checkpoint uses the same
  bounded merge owner. Preparing a different scene generation invalidates the
  old continuation rather than mixing evidence from different runs.

## Speech alternative research — 2026-09-28

- **Sound, medium confidence — keep the frozen exact-word matcher for this comparison.**
  When an alternative spells a word differently or splits it into two tokens, the
  existing scorer reports an unmatched edge. Treating those as successful matches
  would change the evaluator after seeing the candidate. Keep the failure visible
  and explain its cause separately; a future general token-alignment evaluator
  needs its own frozen protocol. The plan left representation differences open.
  This constrains score comparison, not what the app will eventually transcribe.
- **Sound, high confidence — keep research-restricted transcripts out of product evidence.**
  The alternative's license covers generated words as well as weights. Store its
  full research output in scratch and commit hashes, aggregate measurements and
  reproducible probes. This lets later work audit the experiment without silently
  making the model or its outputs part of operational app behavior. The plan
  required license evidence but did not specify artifact placement.

## Frozen-text alignment research — 2026-09-28

- **Sound, medium confidence — use full-recording MPS float32 before tuning context.**
  The aligner accepts this complete recording within its documented five-minute
  range. Feed the entire frozen transcript and audio once, using 32-bit numbers on
  the Mac GPU, so chunk boundaries and reduced precision do not become extra
  variables in the first comparison. The plan did not choose a device, precision
  or chunk policy. This is an experimental starting point, not a product memory
  policy; any later chunking or lower precision gets a separately named trial.
- **Sound, high confidence — retain permissively licensed alignment output with its supplied-text identity.**
  This model accepts our existing words and adds timing; its card declares
  Apache-2.0. Keep the full timed output and the hash of supplied text so another
  agent can rescore every edge without rerunning inference. The separate verbatim
  candidate's research restrictions still apply to its own output. The plan left
  evidence storage unspecified; neither output can serve as independent labels.


## Denoise timing research — 2026-09-28

- **Sound, medium confidence — flush the processing state with explicit zeros, not nearby source audio.**
  A selected final word must not borrow the excluded next word merely to flush a
  filter's delayed output. The research candidate appends zeros after its chosen
  input, removes the implementation's sample delay, and keeps the requested
  count. The plan requires isolation but leaves filter-tail handling open. This
  tests a reversible timing mechanism; it does not yet choose production context
  or establish preserved speech quality. Future state/quality gates can reject it.

## Retained screenshot ownership

- **Sound, high confidence — gaps carry no image reference.** An imported clip
  can have unavailable physical intervals. Its retained index records that range
  with no candidate ordinal, rather than pointing to the preceding picture and
  suggesting the missing footage was visually unchanged.
- **Sound, high confidence — share storage lifetime, specialize evidence meaning.**
  Recording and source indexes use the same retained file checks, descriptor
  lifetime, paging and cleanup. Their domain validators keep actual recording
  revision receipts separate from asset/stream physical sample receipts. The
  recording package representation stays unchanged; source metadata has neither
  a fabricated recording ID nor a fabricated revision.
- **Sound, high confidence — source index files live outside immutable asset bytes.**
  Removing an index generation removes its retained PNGs and coverage, not the
  imported media. Recording directories keep their existing ownership path so
  established recording deletion and portable export semantics remain intact.

- **Sound, high confidence — an unavailable sample is not a missing interval.**
  A decoder can report no picture at one inspected time even within declared
  source support. The index retains that exact unavailable observation and marks
  its surrounding range as lacking a representative, with equality unproven.
  Only support exclusion establishes a known missing source range. This preserves
  useful evidence without upgrading one sample into a claim about every pixel.

- **Sound, high confidence — index completion does not promise an image.**
  If a selected video has no decodable supported pictures, its index can finish
  describing that coverage with no image entries. A caller can see why there is
  nothing to open instead of retrying an impossible image forever. This defines
  source-index readiness; genuine recording indexes still require an image to
  satisfy their existing portable package contract.

## Source selection observations

- **Sound, high confidence — a failed image request is not a missing picture.**
  A decoder can fail because of unsupported media or an internal error even where
  a picture exists. Only the native reader's explicit empty-sample result becomes
  a retained unavailable observation. Its exact requested point and source recipe
  travel with the result, so deleting a temporary job cannot erase its meaning.
  This constrains source index generation to preserve failed work as a failure
  instead of silently treating it as a physical gap.


## Learned denoise baseline — 2026-09-28

- **Sound, medium confidence — measure the unchanged example before fixing its block handling.**
  RNNoise's demonstration program shortens a clip because it skips its first
  output block and never flushes the final one. Keep that behavior visible in
  the baseline, then evaluate any exact-length wrapper as a separate candidate.
  The plan names a learned comparison but leaves its first adapter unspecified.
  This separates a library's noise reduction from whether a wrapper preserves
  the user's selected duration; it selects no production processor.
- **Sound, high confidence — raw-source sampling has its own policy.**
  Recording screenshots combine an edited playback span with cursor overlays;
  an imported source picture has neither. The source selector therefore walks
  physical observations directly while reusing the retained image store and job
  queue. This avoids treating missing cursor evidence as motion or inventing a
  stationary cursor just to make a shared recording state machine fit.
- **Sound, high confidence — scene reasons distinguish sampling time from picture time.**
  If the picture changes at 250ms and the next observation is at 400ms, the index
  requests the previous observed old picture and the newly observed picture. Its
  reason records the actual physical sample clock and the 400ms observation
  separately. Requesting 399.999ms would show the new picture twice and imply
  knowledge of an unseen semantic cut that the samples do not establish.

## Source index preparation

- **Sound, high confidence — queued recipes retain their input scenes; finished indexes do not need them.**
  An index may wait behind another heavy task while scene analysis is regenerated.
  Its recipe keeps the exact earlier stream/context generation until execution or
  explicit retry is no longer possible. Once images and coverage are retained,
  those results can be read independently and older scenes can be reclaimed. The
  source scene owner uses the existing job records for this decision, without a
  parallel lifetime table.
- **Sound, high confidence — explicit index retry follows its failed dependency chain.**
  Canceling a scene or frame job does not make an ordinary index read restart it.
  When the user explicitly retries the index, retryable terminal dependencies get
  one new attempt, including canceled jobs represented as `not_requested` by the
  queue. A terminal child failure ends the parent with its exact dependency, rather
  than leaving a polling parent waiting forever or hiding which request failed.

## Project cut event meaning

- **Sound, medium confidence — report a rate change as an editorial mapping transition.**
  When narration continues from the same source position but changes speed, the
  source-to-project mapping changes. A project cut row exposes both rates so an
  agent can inspect that boundary; it does not claim an audible click or visual
  jump. The earlier plan required cut evidence without defining this case. This
  interpretation gives inspection one deterministic meaning across audio/video,
  holds and replacements, while excluding processor changes from the category.
- **Sound, medium confidence — omit the whole-project opening and terminal boundary.**
  An otherwise unedited single clip has no editorial cuts merely because playback
  begins and ends. An overlay starting later or ending earlier still reports its
  track entrance/exit, because those boundaries are internal to the composition.
  The plan left the outer-boundary convention open. Screenshot indexes must select
  their first/last pictures separately rather than infer them from cut events.
- **Sound, high confidence — derive cuts from mapping continuity, not clip IDs or history.**
  Splitting a clip into two unchanged pieces should not add an apparent edit to
  the inspection report. Compare exact source binding, boundary and rate on each
  side; a source jump or replacement remains visible even if both pieces use the
  same file. The immutable revision supplies authority without a detector job or
  synthetic source generation. This preserves pure splits, fractional timing and
  stable results when the same final composition was reached by different edits.


## Project-cut query integration — 2026-09-28

- **Sound, medium confidence — deterministic ties use the arriving clip.** When a
  cut and a captured observation share a project time, the cut sorts under the
  arriving clip; an exit uses the departing clip. Its internal ordinal sorts before
  source observations of that same clip. The frozen plan required stable ordering
  without choosing this tie key. This preserves every existing source row's relative
  position and avoids adding a global kind-first order that would reshuffle earlier
  event consumers. Future event kinds must use the same exact merge contract.
- **Sound, high confidence — cut readiness belongs to the project coverage.** A
  project made entirely from authored silence can report its gap boundaries even
  though no source evidence exists. The first-page coverage names cuts as ready from
  the revision; per-source cut coverage remains unavailable. The plan required the
  distinction but left its response location open. Attaching cut readiness to each
  source would invent provenance and could not describe a source-free project.

The per-revision boundary index, a single additional bounded merge lane and the
20,000-selected-cut ceiling are delegated index/budget choices, using the existing
128-step page budget and cache lifetime. They introduce no new table, endpoint,
preparation job or persistent reader lifetime. Slice 24 owns release-scale budgets.
## Project index frame-boundary checkpoint

- **Sound, high confidence — keep frame timing in the compiler.** An edit at
  33,366.5 microseconds occurs after the existing picture sampled at 33,366.
  The helper selects that picture as its predecessor and 66,733 as its following
  sample, using the existing clock and shared visibility builder. The spec needed
  project index timing without defining a public selection primitive. This keeps
  later screenshot selection consistent with preview without changing exact edit
  times or adding another clock interpreter.
- **Sound, high confidence — return neighbors, not a screenshot policy.** At the
  project end only the preceding picture exists; an empty project has neither.
  Requests outside the project refuse. The primitive accepts one boundary and
  leaves repeated-candidate removal, sampling density and tap scope to their
  future owner. This parent-approved scope avoids silently choosing how many
  pictures an agent receives while making boundary selection independently testable.


## Public source-generation acceptance — 2026-09-28

- **Sound, high confidence — reproduce a recipe release instead of inventing a
  force retry.** A ready source job intentionally does nothing when retried. To
  verify what an agent sees after an analysis recipe changes, the public journey
  restarts an isolated service with exactly one recipe identifier changed by its
  test-only loader. Existing owners publish a new source attempt; old CLI/MCP
  cursors refuse it and fresh queries succeed. The plan required public generation
  coverage but did not name a legitimate replacement trigger. This adopted test
  boundary avoids adding a product operation or mutating private catalog rows.
  Scene samples are actually produced by the frozen native worker; speech engine
  responses remain the independently labeled frozen fixture. The evidence proves
  consumer invalidation across a simulated release, not two shipped binaries,
  fresh ASR quality, cache eviction or a change to retry semantics.

## Project retained-index selection policy — 2026-09-28

- **Sound, medium confidence — sparse pictures describe observations, not an entire movie.**
  For a long screen recording, select a picture every five seconds as well as
  authored boundaries and both observed sides of scene changes. The existing source
  cadence supplies a reasonable initial density; the plan did not choose project
  density. Keep unknown intervals visibly unproven. A later policy may increase
  density without changing edits; it must use a new selection identity. Source
  stillness cannot omit samples because another layer or processing may change.
- **Sound, high confidence — reuse picture taps and compiler timing.** An agent
  asking for a track's processed storyboard gets the same target as a direct track
  picture. Every selected time resolves through the compiler, and duplicate frame
  requests share a picture while retaining why each was selected. The plan left
  index scope unspecified; whole-project indexes with existing taps avoid another
  filter language or clock. Empty projects return no images; audio-only projects
  can still show their canvas. Processing windows will contribute their own timing
  boundaries when their composition owner exists, rather than inspection guessing
  anchor or interpolation rules.

## Compiled geometry integration — 2026-09-28

The [geometry decision record](assets/15-layer-geometry/choices.md) owns the
sampling/coverage, fixed-canvas, orientation, full-layer receipt and alpha choices.
These are adopted as sound with high confidence: compiler instructions define the
picture, one native executor applies them, and independent pixel controls expose
crop leakage and incorrect source borders. Its provisional allocation limits are
sound with medium confidence; they reject multiplied source/surface work before
allocation but do not establish measured memory or release-scale acceptance.

When a previously imported source has old orientation metadata, silently probing
it again would change immutable evidence underneath an edit. Reject old catalog
format instead, as the user-approved no-migration contract allows, and change every
affected image/scene recipe so cached old pictures cannot masquerade as corrected
output. This integration choice is sound with high confidence; it leaves the
unaffected capture-journal and audio identities alone.

## Project index candidate selection — 2026-09-28

- **Sound, medium confidence — bound one complete selection before rendering.**
  A pathological project with thousands of repeated clips can request many pictures
  and attach many explanations to the same picture. Keep a bounded candidate map
  until the full selection succeeds, then return ordered candidates; stop with an
  explicit limit error instead of returning a partial storyboard. The pass leaves
  budget values in the selection owner, with the exceeded bound and revision in the
  error. The plan required bounded work but did not choose a buffering strategy.
  This makes deduplication across overlapping layers simple and prevents rendering
  work for a selection that will ultimately be refused. Slice 24 still owns measured
  scale acceptance; raising a budget does not require another paging mechanism.
- **Sound, high confidence — move each observed scene side toward its own side.**
  At three frames per second, a scene change at 350 milliseconds first observed at
  400 milliseconds must not select the preceding 333-millisecond picture as the
  new side. Choose at-or-before the actual earlier observation and at-or-after the
  actual later observation, using the compiler clock. Keep exact matches and both
  original and projected times. The policy did not choose directional rounding.
  Omit a side if this choice leaves its occurrence's supported interval; authored
  boundaries still select surrounding output. This avoids attributing a neighboring
  clip to a source observation without claiming raw-source/composite equality.
## Supplied-text coverage diagnosis — 2026-09-28

- **Sound, high confidence — retain the full comparison, including unknown effects.**
  Adding the candidate filler before Return was an explicitly delegated diagnostic,
  not a correction to independent labels. The comparator preserves all 306 original
  words and both edges, exposing two additional unmarked onset shifts. Their
  accuracy remains unknown rather than being silently accepted as harmless.
  Existing scoring owns timing gates; the new helper only enforces correspondence
  and displays changes. No second matcher or production inference policy is added.
- **Sound, high confidence — keep local hypothesis support separate from adoption.**
  Return's error becomes zero against the frozen mark, but p95 and memory still
  fail. Workbench requires wider independent evidence and listening, not label
  movement based on model agreement. The one-condition development trial therefore
  updates the diagnosis while leaving slices 12 and 12b open.

## Public geometry acceptance — 2026-09-28

The [public journey choices](assets/15-layer-public/choices.md) are adopted as
sound with high confidence. Reusing independent authored geometry makes a public
transport success insufficient on its own: delivered pixels and unchanged audio
must still agree. The representative public subset is a checkpoint, not blanket
acceptance of remaining edits, pointers or animation. Full export is tested through
the actual whole-revision API; fractional windows use preview. Committed external
exports survive deletion while service-owned deliveries are revoked by their
existing lifetime owner.

## Source-attached pointer decisions — 2026-09-28

- **Sound, medium confidence — trails follow capture history, including before a trim.**
  If an agent selects a later portion of a capture with a visible trail, the trail
  may include motion immediately before that selected portion. Looking back through
  immutable source support preserves identical output after a pure split and avoids
  inferring edit intent from history. A zero-duration trail requests only the current
  pointer. The plan required source attachment and split invariance but did not pick
  this history boundary; the explicit duration keeps the choice inspectable.
- **Sound, high confidence — source context determines valid targets.** A clip names
  one captured stream; a combined group may contain unrelated recordings and raw
  B-roll. Require a pointer step on the acquisition-bound video clip rather than
  guessing which group member owns it. Registry metadata drives both authoring
  validation and discovery, including atomic incompatible replacement refusal.
- **Sound, high confidence — reuse compiled geometry at every ordered position.**
  A pointer drawn after dimming should remain bright, but it still belongs at the
  cropped/rotated source location. Replay the already-compiled geometric prefix on
  the new overlay, excluding prior opacity, then apply later steps to the combination.
  This keeps arbitrary clip-stack placement without a second transform calculator.
- **Sound, high confidence — make new trail duration explicit and retain existing defaults.**
  Existing still/movie pointer behavior differs, so neither default can silently
  represent both. The new processor requires source-time duration; legacy callers
  retain their policies. Matched-time preservation checks respect the project's
  established frame clock rather than adding hidden pointer-event frames.

## Retained project pictures and receipt boundary — 2026-09-28

- **Sound, medium confidence — keep one immutable composition while writing an index.**
  Appending many pictures from the same revision should not validate and index its
  entire composition again for every image. Reuse one revision/tap planning context
  during the write; another context replaces it, and successful completion clears
  it. The plan did not choose this working-memory lifetime. Residency is at most
  one full composition, its asset metadata and compiler indexes, not one entry per
  project or historical revision. That composition's size still follows the revision
  owner's limits; slice 24 retains measured memory/latency acceptance. Interleaved
  writes may rebuild their context but cannot silently reuse a different revision.
- **Sound, high confidence — each delivered picture gets one complete sampled interval.**
  A picture sampled at zero in a ten-frame-per-second project proves the output
  visible through 100 milliseconds. The direct request's one-microsecond window
  must not shrink that proof, and a completed storyboard must not leave the entire
  delivered frame marked unknown. Project coverage therefore records exactly one
  complete compiler-visible interval for each retained picture; intervening ranges
  have no image ordinal and remain unproven. The plan left coverage serialization
  open. Keeping source availability in picture provenance avoids calling a valid
  background or surviving layer unavailable merely because one source is missing.
- **Sound, high confidence — expose picture evidence, not native rendering instructions.**
  A fresh agent run mistook a renderer's lower-left coordinate for an authored
  top-left placement and made an unnecessary edit before undoing it. Public picture
  receipts now retain timing, layer identity and physical-source observations, while
  the authored processing API remains the place to inspect placement. The native
  worker's complete visual graph is still compared against the compiler before
  publication; only then is it omitted from public/retained receipts. The spec did
  not explicitly separate these representations. Advancing the project-picture
  recipe prevents an old cached receipt from reintroducing the confusing field;
  source pictures, movie pixels and the catalog format are unaffected.

## Pointer wire integration — 2026-09-28

- **Sound, high confidence — disabled effects still travel with processing metadata.**
  A user can keep a pointer step in a clip's stack while bypassing it. The picture
  then needs no pointer renderer, but its request still includes that authored
  step. The native request decoder therefore accepts its trail-duration field;
  otherwise bypass itself would break a previously renderable clip. This is wire
  support only: enabled pointer execution remains unavailable until preparation
  and rendering exist. The schema/compiler checkpoint did not originally name
  this cross-language metadata requirement. Existing raw request validation stays
  strict, and unrelated unknown fields remain errors.

## Project index production and preparation inputs — 2026-09-28

- **Sound, medium confidence — distinguish preparation inputs from durable job-owned media.**
  An index needs its exact scene analysis to finish or retry, but after it copies
  its PNGs it can release that analysis. An import job's result asset and a frame
  job's source asset still need their existing lifetime. Add a preparation-input
  owner to the existing resource references rather than releasing every job
  reference at success or creating a separate scene table. The plan required
  multisource retention but left retirement ownership open. The queue releases
  preparation inputs with successful/permanent settlement; canceled older workers
  keep them until they exit, and explicit retryable failures keep their recipe.
  Forgetting a job releases both kinds. This becomes the shared lifetime for future
  preparation dependencies, with bounded owner cleanup under deletion fences.
- **Sound, medium confidence — refuse old unshipped catalogs when dependency meaning changes.**
  An old source-index job can look ready to retry but has no normalized record of
  which scene generation it needs. Keeping the old catalog would require a JSON
  dependency fallback or a migration. Format 12 instead refuses it explicitly,
  using the project's unshipped reset policy; it does not delete or modify an old
  library. The plan did not say whether semantic reference changes require a
  format change. This avoids two retention interpreters and means development
  libraries must be recreated for this version.
- **Sound, high confidence — a continuation reads the retained generation's pins.**
  An agent can page an old storyboard after a new revision, renderer update or
  scene cleanup. The cursor carries project, revision, generation, tap and picture
  size; stored metadata supplies its renderer and scene identities. Explicit new
  selectors must agree, while omitted optional selectors inherit the cursor.
  Re-resolving current analysis would make valid retained PNGs unreadable. The plan
  left cursor shape and optional-selector behavior open. This keeps continuations
  compact and stable without embedding the potentially large scene list in every
  reference, while deletion still prevents new reads.

## Moving-source edit verification — 2026-09-28

- **Sound, high confidence — source membership needs changing independent landmarks.**
  A moving clip copied onto a fractional timeline position can decode the wrong
  source frame while a static picture still appears correct. The live edit gate
  therefore uses independently authored, changing calibration marks and a physical
  source-frame table, then applies the existing geometry oracle. It never derives
  expected pixels from renderer receipts. The earlier plan named moving-source
  conformance without choosing its oracle. All-intra calibration footage isolates
  membership and geometry; it does not replace broader codec or deep-GOP gates.
- **Sound, high confidence — empty encoded output has a black-pixel check, not a shape mask.**
  Between clips the intended movie frame is opaque black. A decoded value of one
  has no meaningful landmark, but a shape threshold derived from an all-zero
  reference treats it as one. The new journey explicitly checks every RGB channel
  against the existing two-code-value budget and alpha against 255 for these
  authored-empty states; negative controls reject RGB three and alpha 254.
  Nonempty frames retain unchanged landmark checks. The plan left blank codec
  verification unspecified; this adds no wider color allowance or product behavior.


## Displayed frame intervals — 2026-09-28

- **Sound, high confidence — a picture receipt describes its full displayed interval.**
  At ten frames per second, requesting a picture at 2.25 seconds returns the sample
  at 2.20 seconds, displayed until 2.30 seconds. The receipt now says exactly that;
  the separate request time still says 2.25. Previously its visibility field echoed
  the internal one-microsecond decode request while index coverage used the full
  frame interval. The plan required both truthful frame timing and coverage but
  left this public field projection implicit. Using the compiler's existing
  timing owner removes the competing meanings without changing which picture is
  rendered. Native receipts still must match the demanded execution window before
  projection. Future consumers can compare direct pictures and storyboard
  coverage; the changed metadata has a new cache recipe identity.


## Pointer sampling work bounds — 2026-09-28

- **Sound, medium confidence — reread forward history for a backward request.**
  If a clip jumps from source second ten back to second two, the sampler restarts
  the existing forward history readers and reconstructs the earlier pointer state.
  It retains the accumulated work count, so repeated jumps cannot bypass the
  attempt limit. The plan required arbitrary source-time inspection and bounded
  memory but did not choose between rereading and a new random-access event store.
  Rereading keeps one history owner and avoids retaining all events. Highly
  shuffled projects may reach the explicit limit; release-scale performance is
  still a separate gate, not established by the focused tests.
- **Sound, high confidence — bound repeated output work separately from source events.**
  Holding one source picture for many output frames can request the same pointer
  state repeatedly without advancing source history. Counting only source events
  would leave that work unbounded. The sampler therefore also counts requested
  output occurrences, including repeats. The plan required bounded preparation
  but left the counters unspecified. Future preparation can refuse excessive work
  explicitly instead of silently truncating overlays; resource thresholds remain
  provisional until the scale slice measures them.

## Timeless still-image preparation — 2026-09-28

- **Sound, medium confidence — bound decoded pixels before asking ImageIO for pixels.**
  A small compressed image can expand into a large memory allocation. Both import
  and picture delivery now reject images above a shared 8192×8192 pixel-count
  ceiling before decoding; a caller can request a smaller budget. This is a
  provisional bound at the existing compositor's source-work magnitude, not a
  measured release-scale memory guarantee. The plan required bounded work but
  left image admission limits open. The one-pixel negative control proves the
  budget affects execution; release measurement may lower this single owner.
- **Sound, high confidence — share image admission and rendering, including refusal.**
  A partially downloaded JPEG may let ImageIO return plausible partial pixels.
  Importing that file and later treating it as complete would make the same asset
  mean different things. Both paths now require one fully decoded PNG/JPEG frame,
  valid dimensions and orientation; animation and incomplete data are refused.
  The plan did not define recoverable truncation. This preserves original bytes
  and makes admission match the pixels future project rendering can consume.
- **Sound, high confidence — image receipts have no pretend video clock.**
  Inspecting a photograph should return its identity, orientation, alpha and
  dimensions. It should not invent a sample at time zero or a duration merely to
  fit a video response. The native receipt therefore identifies an image, and
  existing frame sizing/publication is shared below the timing boundary. The plan
  required still admission but left this shape open. Public source selection and
  project image provenance must preserve that distinction in the next pass.


## Acquisition-gap picture scope — 2026-09-28

- **Sound; medium confidence — Test selected acquisition gaps using the public producer.**
  A video clip attached to captured audio disappears when that selected audio
  context says its parent was unavailable. The same video bytes remain readable
  directly and in a full-context occurrence. The plan required delivered pictures
  across acquisition gaps but did not define an arbitrary video-mask authoring
  API. This pass uses existing public capture admission and content attachment to
  cover that project behavior, keeping its `anchor-unavailable` provenance distinct
  from direct source exclusion. A future direct video-support producer belongs to
  acquisition admission in 10b and needs authoritative capture evidence; native/core
  support for narrower video masks does not itself promise that public producer.

- **Sound; high confidence — Missing parent support suppresses its child picture.**
  An attached video whose parent has a capture gap must leave the background or
  other layers visible. Rejecting the entire frame would make the compiler's valid
  unavailable interval impossible to inspect or preview. The native executor now
  treats that declared gap as transparent after the existing physical-source checks,
  and retains the ancestor reason. This completes the earlier unsupported execution
  path without letting a decoder invent evidence that the parent was available.

## Public raw image inspection — 2026-09-28

- **Sound, high confidence — omit time to request a still image; validate the actual stream.**
  An agent inspecting a photograph supplies its asset and stream, while an agent
  inspecting video also supplies a source time. The service checks the admitted
  stream instead of accepting either shape for any media. Image time/acquisition
  context is refused, and timed batches stay timed. The public design requested
  omission of time; the remaining choice was whether to ignore incompatible
  fields. Refusal prevents a caller from mistaking a photograph for evidence of
  a requested instant. The returned PNG is upright; retained orientation describes
  the source, so the skill explicitly warns against interpreting it as output rotation.
- **Sound, high confidence — isolate raw image lifetime from a referencing project.**
  Deleting an edit that used a photograph must not invalidate a separately admitted
  original or its raw inspection. Raw image jobs and delivered PNGs therefore use
  the existing asset-owned references, cache and leases. Project deletion is the
  available public deletion surface; no asset-delete API is invented for a test.
  The plan requested deletion coverage without specifying that absent surface.
  The live journey verifies project/source independence and delivery closure;
  any future asset deletion must add its own explicit drain/revocation gate.

## Project still-image composition — 2026-09-28

- **Sound, medium confidence — retain images only while their binding contributes.**
  If the same photograph appears in two overlapping clips, both reuse the same
  decoded image. When neither clip is present, the executor releases that image;
  a later repeat can decode it again. The plan required bounded rendering without
  defining image residency. Keeping every photo for the whole movie would make
  memory grow with project length. Active-source retention makes the bound depend
  on simultaneous sources, matching the existing video executor. Still-image pixels
  are charged once per binding even when several clips reuse them; video retains
  its per-occurrence decoder accounting. The current pixel
  allowance is provisional until release-scale measurement.
- **Sound, high confidence — give compiled images an explicit timeless kind.**
  A photograph placed for two seconds is visible during project time, but no
  camera sampled it at source time zero. Compiled layers and returned picture
  receipts distinguish images from videos; images omit source/sample clocks.
  Existing authoring uses a hold at zero to select the whole image, so no new
  editing operation or second timeline is added. The plan fixed timeless semantics
  without fixing the compiled representation. Explicit kinds prevent consumers
  from treating a sentinel number as evidence of an observed video frame.
- **Sound, high confidence — refuse development catalogs missing the new retained provenance.**
  A previously retained index contains picture receipts without image/video kind
  and decoded-image counts. Reading those as today's schema would silently guess
  provenance, while rendering them again would change retained-history semantics.
  Catalog format 13 therefore refuses older development catalogs under the existing
  no-migration rule. Renderer recipe changes independently invalidate disposable
  frames and previews. This chooses a clean persisted contract over compatibility
  inference; it does not change the user's original media files.

## Public pointer admission and recovery

- **Sound, medium confidence — cap synchronous dependency selection by metadata work.**
  A long held clip should not require scanning every output frame just to start a
  render. The compiler finds actual discrete samples inside exact available
  intervals, with a provisional work ceiling and the existing source-count cap.
  Exceeding these bounds refuses preparation; slice24 must measure useful capacity.
- **Sound, high confidence — preserve source history while an index produces frames.**
  An index occupies the heavy lane while its frame children run. If those children
  queued heavy history work, neither could finish. Admit history first and retain
  cache descriptors across the index producer. Lost prerequisites release the lane
  for one existing queue readmission; repeated loss fails explicitly. The persisted
  readmission flag prevents automatic recovery from gaining explicit child-retry authority.
- **Sound, high confidence — use real transitions, not reads, to wake waiting parents.**
  Creating a nested child or failing its admission can change a parent already
  visited in the queue snapshot. Coalesce one later event turn for those changes.
  Unchanged waiting/pressure and ordinary reads schedule nothing. Retained history
  byte receipts reject impossible aggregate cache sizes before regeneration churn.
- **Sound, high confidence — distinguish dependency repair from arbitrary rendering retry.**
  Explicit export retry repairs failed pointer preparation or its returned pinned
  renderer. Unrelated decoder failures retain the existing explicit preview-retry
  policy, including a newer failure behind a stale parent error. Already prepared
  cached/staged bytes use publication readiness and can finish without old renderer
  availability. This extends the prerequisite flow without changing unrelated retry intent.
- **Sound, high confidence — bind readiness to the actual preparation owner.**
  Test or alternate renderers without pointer support cannot advertise executable
  pointer steps. Production passes the validated composition in process; public
  manifests gain no capture metadata. Joint image/pointer recipe identities prevent
  reuse of incompatible disposable receipts; the image pass owns Catalog13.

## Guarded stretch research inputs

- **Sound, medium confidence — make phrase guards part of the selected input.**
  The existing visual phrase marks have about 25 ms uncertainty. The audition
  includes an explicitly selected 25 ms on either side before stretching, then
  leaves the outer 250 ms untouched. This allows a useful join comparison without
  secretly feeding excluded neighboring speech into the processor. The original
  plan did not choose audition margins. These are research selections, not an
  automatic editor policy; independent complete-word labels still need proof.
- **Sound, high confidence — separate a whole utterance from labeled word spans.**
  The clean reference has a transcript but no sample-exact first/last-word times.
  Processing its whole file provides a listening control for MISTER and GOSPEL,
  while claiming precise protected-word spans would invent evidence. The plan
  permits independent clean controls without prescribing this clip. Future
  endpoint acceptance must retain this distinction; file boundaries are not
  automatically word boundaries.

## Short stretch alternative research — 2026-09-28

- **Choice:** Test Rubber Band as an explicit research candidate, without choosing
  it automatically for short clips. A 10 ms selected sound may be accepted by this
  engine even when the incumbent cannot process it, but exact duration and pitch
  alone do not prove that a word beginning or ending survives. The existing engine
  therefore stays the numerical candidate while endpoint and listening gates stay
  open; no clip silently receives a different processing recipe.
- **Gap:** The plan requires useful short edits but did not choose an alternative
  engine or authorize a duration-based switch.
- **Reach:** Future integration must resolve speech quality and distribution terms
  before adopting this engine; scratch compilation does not add a product license
  or runtime dependency.
- **Verdict:** Sound, medium confidence. Preserve the measured short-tone gain and
  endpoint regression together without converting either into product policy.
## Pointer product skill clarification

- **Sound, high confidence — discover processor scope instead of prescribing a pointer recipe.**
  An agent tried a captured pointer on a track even though the service advertised
  clip-only support. The skill now asks for target and acquisition capabilities
  before selecting scope, so future processors still use their own advertised
  contract rather than inheriting a hard-coded pointer exception.
- **Sound, high confidence — distinguish retained identities from new effects.**
  When adding dimming beside an existing pointer, keep the pointer's returned ID;
  when adding a new effect, omit its ID and let the service assign one. Otherwise
  the agent can accidentally recreate an existing effect or invent an ID the
  service rejects. Requests and receipts from failed attempts remain separate
  from successful recovery, preserving what actually happened for inspection.


## Scalar curve compiler prerequisite — 16a

- **Choice:** Restrict animation by keeping its original function and clock, then
  narrowing where it is active. For example, splitting a zoom halfway through a
  curved acceleration should keep the same acceleration on each side; starting
  a fresh curve from the split value would change its motion. The compiler keeps
  its complete keys and exact clock behind intersected project windows.
- **Gap:** The contract allows either exact curve reparameterization or an
  evaluation window; this pass chooses the window representation in process.
- **Reach:** Slice 16 must preserve this function/clock when it connects persisted
  processing edits and native execution. This pass does not choose that storage
  format or advertise runnable animation. It avoids a second source-clock or
  easing owner in workers.
- **Verdict:** Sound, high confidence. Pure restrictions preserve every original
  sample exactly without approximating cubic control handles.


## Opacity temporal processing vertical — slice 16

- **Choice:** Retain the portion of the original normalized clip clock explicitly
  on the processing step. After a halfway split, one child reports [0,1/2] and the
  other [1/2,1]; the same original keys and activation window continue to mean the
  same motion. Repeated trims restrict that retained interval again, using the
  existing partitioner's exact ranges. The plan required original-function
  preservation but did not choose its persisted representation.
  **Verdict:** sound, medium confidence. `evaluationRange` is visible through
  get/set and follows normalized clip timing; it is not another source timeline.
- **Choice:** Reject an opacity curve whose actual cubic extrema leave [0,1],
  rather than clipping it silently or forbidding every overshooting easing handle.
  For example, a small fade around 0.5 can safely use a y handle outside [0,1].
  The plan fixes opacity's physical bounds but did not choose how curved overshoot
  should be validated. **Verdict:** sound, high confidence; valid motion remains
  expressible and invalid alpha never reaches native execution.
- **Choice:** Keep authoring windows and opacity values out of native metadata.
  The compiler has already emitted each picture's numeric opacity, so sending
  the original curve would ask the worker to carry a second unused description.
  One shared service-boundary projection is used by delivery and direct native
  harnesses; strict unknown-field rejection remains intact. The plan left this
  transport narrowing implicit. **Verdict:** sound, high confidence. Native still
  receives the routing, step identities and executable gain/pointer parameters
  it needs; no native authoring evaluator or silent dry fallback is added.

## Slice 22a — Portable snapshot boundary

- **Sound, medium confidence:** Adopting a package creates new project and revision
  identities while keeping clip/track/processing identities inside its documents.
  This allows two independent copies in one library without revision collisions;
  the adoption receipt maps donor revisions to their new identities.
- **Sound, medium confidence:** Copy and hash media before the shared publication
  transaction, then expose asset rows and the entire project together. Failed
  transactions can leave invisible immutable files for existing startup recovery;
  they cannot expose a partly adopted project.
- **Sound, high confidence:** Preserve the actual active undo stack separately from
  historical documents. Undo/restore operations append revisions, so deriving undo
  from the last two documents would change the next undo after relocation.

## Animated scale vertical — slice 16

- **Choice:** Use closed internal scalar slots for opacity and scale x/y, with one
  clock per processing step and separate compiled programs per scalar. This extends
  the existing curve owner without a generic author-facing parameter-path API.
  **Verdict:** sound, high confidence. Both axes retain the same original clip
  timing through edits while independent values cannot overwrite each other's cache.
- **Choice:** Preserve signed and zero scale, validate complete curve extrema for
  finiteness, and keep numeric matrix safety checks at emission. Do not clamp values
  or reject a curve merely because it crosses zero. **Verdict:** sound, high
  confidence; animation inherits the established static geometry semantics.
- **Choice:** Extend the existing native projection to omit geometry authoring
  values after matrix compilation. **Verdict:** sound, high confidence. The worker
  has no second curve evaluator and direct harnesses share the same projection.

## Slice 22 — Public archive checkpoint

- **Sound, medium confidence:** This checkpoint refuses a non-current revision
  while the project owner only represents a current head at the end of history. A project
  export names its current editable state plus all retained history. Earlier
  revision export stays an explicit follow-up until the project owner can represent
  that branch without ordinal collisions or changed undo meaning.
- **Sound, medium confidence:** An adoption job returns only durable project and
  revision IDs. A long history or large document can exceed the bounded job-result
  envelope; returning its IDs lets the caller read the normal paged history without
  reporting a successful catalog commit as a failed oversized job result.
- **Sound, high confidence:** Each service explicitly selects its package format
  validator. Opening a project ZIP in the recording service does not reinterpret
  it, and opening an old recording package in the project service does not migrate
  history. The archive parser and resource lifetime remain shared.
- **Sound, high confidence:** Package export assembly has its own private managed
  root, separate from temporary opened-package handles. Restart recovery can clean
  expired opened ZIPs without deleting work retained by a durable export intent.

## Slice 16 — Animated position and rotation

- **Sound, high confidence:** Keep animated position in the existing rectangle's
  x/y fields and animate the existing clockwise angle. For a presenter moving
  right while rotating, the agent supplies curves in those same fields instead
  of a second translation object whose order could disagree with the rectangle.
  The plan named position animation without naming another representation; this
  preserves the established static placement and transform order. Future geometry
  consumers inherit one position owner and the same per-step clock.
- **Sound, medium confidence:** Deliver position/rotation before animating crop,
  rectangle size or pivot. A moving presenter gains a verified trajectory without
  pretending size-bound validation and changing crop support were exercised.
  The plan allowed reviewable passes without fixing their grouping. This is a
  checkpoint boundary only: remaining scalar consumers and full slice16 acceptance
  remain open and continue under their original contracts.

## Slice 22 — Acquisition dependency checkpoint

- **Sound, medium confidence:** Acquisition admission is a typed import/package
  union. A package has no capture-directory import path, so it must not invent one
  or pretend to rerun native parsing. Catalog format 14 requires a fresh library,
  following the existing development no-migration contract.
- **Sound, high confidence:** Retain acquisition, source and generation identities
  exactly while project/revision identities remain fresh. History and provenance
  reference those acquisition identities; collisions require complete matching
  metadata and local byte hashes rather than silently remapping their meaning.
- **Sound, high confidence:** SourceEvidenceStore ingests the exact packaged
  normalized bytes under a pending acquisition reservation. The existing project
  transaction publishes acquisition metadata and references together with assets
  and history. Unpublished staged evidence remains unreachable and existing owner
  recovery reclaims it.
- **Sound, high confidence:** Acquisition IDs require the lowercase canonical form
  emitted by their sole Node randomUUID producer. Native capture session IDs are
  separate source identities and retain their original spelling. Exclusive directory
  creation protects retained data even when staging finds an unexpected directory.
- **Sound, medium confidence:** General resource references carry asset and
  acquisition closure through one graph walk. Scene-generation resources still
  refuse export until their real retained owner and queue readiness are portable;
  the refusal is a checkpoint boundary, not reduced final package scope.

## Slice 16 — Crop, dimension and pivot curves

- **Sound, high confidence:** Preserve the static geometry domain for animation.
  When an agent moves a crop partly outside the source, it remains a valid crop
  just as the same constant rectangle was valid. Width and height must stay
  positive and each pivot coordinate between zero and one, but no new rule forces
  the rectangle inside an image. The plan required static-domain preservation;
  it did not spell out whether to add a combined inside-image constraint. Adding
  one would reject existing creative placements and create a second geometry policy.
- **Sound, high confidence:** Use the smallest positive representable number as
  the lower bound for a size curve's complete value function. A curve that touches
  zero halfway through is invalid even with positive keys; an arbitrarily small
  positive value is not rejected merely by choosing an unexplained epsilon.
  The plan required strict positivity without choosing a numerical expression.
  Sampled matrix precision remains the existing compiler's responsibility, so this
  does not promise that tiny dimensions produce safe output matrices.

## Composed PNG delivery boundary

- **Sound — high confidence:** Deliver a completed composition through the existing
  oriented-image sizing/PNG path. Source-edge sampling belongs before composition;
  applying it again changes the finished artwork. Preserve the source decoding path
  and advance the picture cache identity so prior altered borders are not reused.
  This adds no processor, model, profile, or new public API.

## Slice 22 — Retained source-scene checkpoint

- **Sound, high confidence:** Imported readiness belongs in the existing artifact
  publication table, with the original attempt identity and no fabricated local
  job. The queue reports a ready imported result with a null job ID and reserves
  later real generations beyond it. Exact publication conflicts refuse adoption;
  active local work is retryable, terminal identity conflicts are explicit failures.
- **Sound, high confidence:** Pin immutable scene metadata and retain it through
  existing export references. Read and hash chunk payloads only in the heavy archive
  job. Indexed owner/artifact/attempt lookup avoids scanning unrelated publications
  for each retained generation.
- **Sound, high confidence:** Stage scene chunks through their existing normalizer
  as unpublished rows. Validate actual source ownership and publish them in the
  adoption transaction. Startup recovery scans pending generations independently
  of asset publication, and bounded event-loop yields permit real cancellation.
- **Sound, high confidence:** Preserve the original sampler implementation identity
  in retained publication inputs. Validate its source selection and policy without
  relabeling historical analysis as the recipient's current implementation.

## Native sampling bounds

- **Sound — high confidence:** Keep selection geometry expressed as pixel centers
  in the compiler and translate to Core Image pixel-cell rectangles at the native
  API boundary. Source orientation also retains whole pixel cells. This preserves
  source edges instead of blending away their outer halves; it introduces no new
  authoring choice, processor, or shared geometry owner. Advance all affected
  picture/movie and source-evidence cache recipes together.
## Canonical numerical scalar prerequisite

- **Sound; high confidence — one mathematical program for preview and audio.**
  When a steep curve approaches its endpoint, rounding a tiny time remainder can
  change the result much more than expected. The compiler now keeps that remainder
  exact, then runs short polynomial instructions shared with native audio. Native
  receives numerical coefficients, not a second copy of editorial easing rules.
  Independent endpoint and fractional-center formulas catch the precision failure;
  matching native and TypeScript results alone is not the correctness argument.
- **Sound; high confidence — a fixed global sample origin survives cuts.**
  Each curve piece chooses its nearest sample origin before a preview window is
  selected. A shorter render or fractional split therefore evaluates the same
  original envelope. Activation keeps the existing floor rule, while curve key
  selection uses ceil because the first sample at or after a key owns its value.
  This is a compact key-sized program, not a duration-sized gain array.
- **Corrected unsound provisional choice; high confidence — no new Int128 limit.**
  A legal pair of nearly equal normalized fractions exceeds fixed-width native
  rational arithmetic after composition. The initial proposed refusal was removed
  before implementation. Exact clock lowering stays in the existing BigInt owner;
  native executes finite sample offsets and slopes. Existing native audio schedule
  precision bounds justify those finite numbers, rather than the fixtures alone.
- **Sound; high confidence — prerequisite proof does not advertise gain delivery.**
  Numerical conformance and preserved PNGs verify the shared evaluator seam.
  Animated gain remains unavailable until ordered native mixing, bypass, joins,
  range renders and actual PCM comparisons are implemented and verified.
- **Sound; high confidence — stop when arithmetic cannot narrow further.**
  A fixed number of searches can leave a small timing error that a large but legal
  gain magnifies. The shared solver stops when its two bounds are neighboring
  floating-point values, with a ceiling derived from the number format. Exact
  authored endpoints bypass that search. A legal long-span example now agrees with
  an independent formula; the measured native cost remains explicit in the evidence.

## Slice 22 — Retained source-transcript checkpoint

- **Sound, medium confidence:** Reconstruct the bounded native receipt from retained
  segment rows and word counts, then package it beside exact raw native bytes. When
  a transcript moves, the existing indexer can validate the original receipt and
  rebuild its normal tables; a second package-specific transcript format would
  duplicate that authority. The plan did not prescribe receipt storage. This keeps
  future format validation in the existing transcript owner and caps receipt size.
- **Sound, high confidence:** Preserve original engine/model/decoder identities but
  replace only the donor media locator. A receiver without models reads imported
  ready evidence immediately. It does not relabel old words as produced by its
  current model or fabricate an inference job. Future regeneration remains ordinary
  explicit local processing; shared queue publication retains the old identity.
- **Sound, high confidence:** Stage raw bytes and indexed rows before the shared
  adoption transaction, and recover pending generations independently of asset
  publication. A crash after raw copying can leave no transcript row at all, so
  recovery also scans the existing transcript directory owner. A canceled package
  cannot leave visible evidence or block a later retry with an orphan directory.
- **Sound, high confidence:** Freeze raw file identity while pinning; reconstruct
  receipts and copy/hash bytes only in the heavy export job. The package's generic
  reference graph retains each immutable transcript generation until publication
  or abandonment, so history does not silently fall back to a newer transcript.
### Retained-output research uses the compiled output target before production adoption

- **When:** 12c retained-output reproduction.
- **Choice:** Prove state over the selected combined output before designing clip-level storage. When a five-second selection is split into two clips, the experiment compiles both into the same five-second signal and prepares that signal once. A later preview reads its saved samples. Trimming away a second instead prepares the newly selected signal; it cannot silently crop the old denoised file. The alternative would invent clip lineage and cache policy before the signal contract is measured.
- **Gap:** The plan requires a split-safe state strategy but does not choose the first target scope for its reproduction.
- **Reach:** This establishes an output-target mono mechanism only. Future clip-level preparation, window transitions, durable publication and stereo policy still need their own evidence. The harness adds no production storage owner or readiness flag.
- **Verdict:** Sound — exercises actual compiler/native selection while leaving unproved product policy unavailable.
- **Confidence:** High.

## Durable prepared-audio lifecycle prerequisite

- **Sound, high confidence — publish through the existing queue fence.** File
  preparation finishes before settlement; a synchronous catalog callback then
  publishes asset metadata and revision references in the same transaction as the
  queue result. Cancellation or a newer attempt prevents that callback from running.
  This avoids a second registry that could say audio is ready after its job failed.
- **Sound, high confidence — share bytes without mixing their histories.** Two
  unrelated projects can produce identical silence. Their PCM asset may be shared,
  but their source dependencies belong to each immutable publication receipt and
  revision reference set. Putting those dependencies on the shared asset would
  unnecessarily retain or package another project's sources.
- **Sound, high confidence — retain exact local file identity separately from the
  recipe.** Drop the staging hard link before capturing identity because unlinking
  it changes filesystem metadata. A later bounded reader refuses substituted files
  rather than silently re-rendering different bytes. Relocation must adopt a new
  local identity while preserving recipe and content identity.
- **Sound, high confidence — refuse incomplete portable exports.** The first
  checkpoint establishes core storage and lifecycle behavior. Until the existing
  package owner learns this resource, export reports unsupported prepared retention
  instead of producing a package that silently loses it. Native constant gain and
  unit-rate verification do not make RNNoise or stretch executable.

## Ordered native gain delivery

- **Sound; high confidence — keep editable settings separate from execution.**
  An agent inspecting a fade still receives its keys and original clip clock.
  Rendering lowers those settings into numerical instructions through the same
  compiler that owns picture timing. The numerical program is not saved as a
  second editable representation or sent back as replacement authoring settings.
- **Sound; high confidence — retain the constant path and explicit stack order.**
  Ordinary constant volume changes use the same Float32 loop. Animated gain is
  evaluated once for each stereo frame at that exact step in the stack, including
  after children are mixed at a parent. No hidden normalization or automatic
  ducking changes the agent's requested levels.
- **Sound; high confidence — retain the unready stretch boundary.**
  Moving, cutting and trimming a unit-rate audio clip now preserves delivered
  gain envelopes. A duration-changing edit still needs the unaccepted stretch
  executor, so its existing not-ready result remains. Pure timing checks support
  later integration; they are not evidence that stretched speech is deliverable.


### Convenience edits append a new ordinary step

When: slice16 explicit fade/zoom pass.

The choice: adding a zoom after an existing crop leaves the crop intact and adds
another geometry step consuming its output. Adding a fade likewise keeps previous
level adjustments. The caller receives the complete updated stack and can move,
edit or bypass the new step by its ordinary ID. The plan required inspectable
expansion but did not select replacement versus append or the convenience shape.
Replacing an existing geometry step would silently change unrelated authored work.
The reach: callers must inspect the current stack and choose crop/rectangle settings
for the image at that point. Verdict: sound; preserves explicit authorship and the
single stack owner. Confidence: high.

### Convenience windows do not invent a terminal hold or round time

When: slice16 explicit fade/zoom pass.

The choice: a fade-out from one-quarter to one-half of a clip is active only in
that interval, then the original unfaded level returns. To stay silent after it,
the caller authors an ordinary curve through the intended end. Source/project
convenience endpoints must be whole microseconds; a fractional endpoint is refused
instead of shifting the requested animation. Normalized clip fractions remain
supported. The plan left the shorthand's behavior at its edges unspecified.
The reach: the shorthand keeps existing dry-outside-window and integer-key rules;
it adds no hidden end key, second clock or rounding policy. Verdict: sound, because
ordinary processing remains the complete expressive path and receipts describe
exactly what executes. Confidence: medium.
## Output settings functional checkpoint

- **Sound, high confidence — keep authored replay identity separate from encoder settings.**
  An export requested with a preset stores both the request and its resolved values.
  Repeating that export ID reuses those values even if defaults change later; a new
  export can resolve the new preset. Empty settings preserve the existing request
  identity. Render caching uses resolved values so equivalent requests share work.
- **Sound, high confidence — preserve the internal audio clock while exposing output format.**
  A request for44.1kHz mono AAC still mixes the composition at its existing48kHz
  stereo clock, then asks the encoder for the chosen output format. This avoids
  changing edit/gain sample ownership just to change delivery format. Both internal
  and encoded formats are reported; public tests check track duration and layout.
- **Sound, high confidence — verify the encoded header before publication.**
  A requested H.264 profile/explicit level must match the actual sequence parameter
  set. Echoing the request cannot prove encoder behavior. Auto level reports the
  encoder-selected level. This adds a bounded metadata read, not a second renderer.

### Balanced encoding favors the middle measured quality/size tradeoff

- **When:** 09b output quality decision.
- **Choice:** Use an 8 Mbps encoder target when an agent leaves video rate control
  unspecified. A ten-second screen recording at this setting costs about 6.5%
  more bytes than the compact candidate and reduces the sampled pixel error by
  about 7.7%. The sharper candidate costs another 13.1% for a smaller error
  reduction. An agent can request any supported explicit setting; the preset
  does not restrict the controls or promise a particular file size.
- **Gap:** The user chose balanced sharpness/file size, leaving the numeric default
  to measured evidence.
- **Reach:** Ordinary exports inherit this starting point. Fine grids can benefit
  from sharper settings, and this small screen-recording corpus does not establish
  the best value for every kind of footage. Existing fidelity failures remain open.
- **Verdict:** Sound as a reversible default, supported by four cohorts and an
  independent visual review rather than preset names alone.
- **Confidence:** Medium; preference between marginal sharpness and bytes varies
  by content. Change the preset default if broader evidence supports another
  point; retained export intents keep their original resolved settings.


### Font faces belong to immutable bytes, with bounded descriptive metadata

When: prerequisite17b font admission.

The choice: importing a collection lists each face under its exact PostScript
name, scoped to the file's asset hash. A second file may reuse the same name and
remain a different dependency. Duplicate names inside one file are refused so a
later caption never resolves an ambiguous first match. Family/style are display
metadata, not a font lookup. The parent confirmed this identity choice where the
text plan had required an explicit font without defining its public identifier.
The existing probe envelope keeps origin zero and no streams for fonts, while a
separate count makes them discoverable. The admitted collection is capped at 256
faces to keep metadata within the existing probe cardinality boundary; larger
collections are explicitly unsupported. The reach: rendering must resolve this
pair from retained bytes rather than use an installed font by name, and project
caption references must later retain this ordinary asset dependency. Verdict:
sound, preserving one blob/reference owner and explicit font identity. Confidence:
high for identity/ownership, medium for the conservative face-count limit.
## Slice 22 — Retained project screenshot indexes

- **Sound, high confidence — bind portable indexes to the revision they describe.**
  A project can keep pictures for both its current edit and an older edit. The
  package snapshot adds each retained generation to that exact revision's dependency
  references. Adoption changes project/revision identities and those references
  together; the picture times, clip identities and pixels keep their meaning. The
  plan required complete history but left these dependency roots unspecified. This
  makes future deletion and re-export follow the existing reference graph.
- **Sound, high confidence — inspect retained pictures without granting execution.**
  A receiver may lack a pointer executor while already holding its validated PNGs.
  Retained validation compiles the original picture meaning without requiring that
  executor to run, and keeps the unavailable requirement explicitly unavailable.
  Ordinary rendering still requires readiness. The plan did not prescribe this
  compiler read boundary; sharing it prevents a second interpretation of history.
- **Sound, high confidence — a ready receipt does not need its donor job.**
  Importing an index preserves the queue's published result, but does not invent
  a completed worker job. An inspection now uses that exact result immediately.
  Submitting fresh work solely because the donor job is absent would replace the
  generation while the caller is reading its pictures. The plan left the read-side
  admission decision unspecified; explicit retry and new recipes retain their
  ordinary execution paths.

## Explicit encoder control decisions

- **Sound, high confidence — preserve full GPU identities as decimal strings.**
  A machine can identify its graphics device with a 64-bit number that JSON
  cannot represent exactly as an ordinary JavaScript number. The agent sends
  the discovered decimal string, and native code validates its unsigned range
  before creating the writer. This prevents a valid device choice from silently
  rounding to another ID; the plan did not specify the wire representation.
- **Sound, high confidence — distinguish required selection from preference and telemetry.**
  A required software, hardware or GPU policy goes into both preflight and the
  actual writer. Successful writing under that hard constraint establishes
  enforcement. A preferred GPU explicitly permits fallback. The platform does
  not expose the writer's selected encoder session, so receipts do not invent
  an observed ID from a separate preflight session. This retains the existing
  writer owner rather than replacing it solely for telemetry.
- **Sound, high confidence — explicit null requests the encoder default.**
  A software encoder can reject an optional hardware-oriented property even
  when the requested value is false. Agents inspect per-encoder capabilities
  and set a nullable control to null when they intend to leave it unspecified.
  Default presets remain intact, unsupported explicit values still fail, and
  the resolved receipt preserves the null. The alternative of silently omitting
  unsupported preset values would conceal which request was actually honored.
- **Sound, high confidence — unavailable public controls remain discoverable.**
  An SDK resampling key passed admission but failed actual AAC writing. Discovery
  explains that it requires another conversion path rather than presenting a
  working knob or pretending an accepted dictionary proves support. Read-only,
  private and separate realtime/multipass workflows likewise remain distinct
  from verified offline controls. No unverified DSP or codec is added by this
  settings feature.

## Slice 14a — Prepared recipe portability

- **Sound, high confidence — bound a whole-project recipe by its package budget.**
  A short project made of many small clips can have a larger execution description
  than a long single clip. Export preserves that complete description under the
  existing package manifest limit. Reusing the smaller input limit for simple
  artifact recipes would refuse valid prepared results even when the package fits.
  The plan required bounded metadata but did not choose a separate recipe limit.
  This keeps one enclosing budget and forbids truncating ordered processing or
  provenance merely to satisfy an unrelated small-recipe bound.

## Operation help selection (CLI discovery follow-up)

- **Choice:** Keep one registry and let an agent request one operation with
  `screenrec <operation> --help`. For example, importing a font needs the asset
  import schema, without loading every curve and editing schema first. Bare help
  still supplies the full catalog; an unknown operation is an explicit error.
- **Gap:** The plan required discoverable schemas but did not specify how a
  caller narrows an increasingly large catalog.
- **Reach:** This changes offline CLI discovery only. MCP and service operations
  retain their existing schemas, and no preset restricts explicit settings.
- **Verdict:** Sound: reduces irrelevant output without adding a second schema
  owner or hiding any capability. **Confidence:** High.

## Slice 17c — Literal text ownership

- **Sound, high confidence — text uses the existing clip graph.** A title that
  follows a video uses the same attachment as another visual layer. It therefore
  splits, moves and repeats with that parent instead of needing a second caption
  timeline. The parent explicitly approved removing the unshipped empty captions
  field; frozen historical evidence retains its original format and build boundary.
- **Sound, high confidence — exact font bytes stay ordinary asset dependencies.**
  Changing a caption's font leaves its earlier revision able to undo and render.
  One shared dependency extractor roots media and font assets for history and
  packages. Native receives a separate font binding because a font has no playable
  stream; it does not register fonts globally or select a face by ambient name.
- **Sound, high confidence — layout reuse preserves literal code units.** Two
  visually equivalent Unicode spellings may have different character ranges.
  Raster reuse compares exact UTF-16 literals so their receipts keep the caller's
  ranges. Reuse lives within active frame surfaces and existing pixel budgets,
  without another persistent cache or unbounded glyph store.
- **Sound, high confidence — canvas alpha is honored before codec admission.**
  A transparent PNG remains transparent; an H.264 movie is admitted only when its
  final pixels are opaque. This corrects the misplaced movie restriction in the
  shared picture background without adding a matte or relaxing the movie gate.
- **Sound, medium confidence — missing selected glyphs refuse separately from
  font substitution.** A missing-glyph box from the chosen font is not proof that
  the requested character rendered. Native refuses glyph zero as well as runs from
  a substituted font; finite-box clipping remains the explicitly requested layout
  behavior rather than an implicit font fallback.


### Historical packages capture the selected moment

When: slice 22 historical export checkpoint. Verdict: sound. Confidence: high.

The choice: if a project has edits A, B and C and the caller exports B, the copied
project opens at B with its history and undo stack through B. C stays in the donor
and is absent from that package. Later donor undo, restore or edits cannot change
what B meant. The plan required history retention but did not define whether an
older selected head should also carry its future. Keeping those later edits would
introduce a different branch model and unclear undo behavior. The reach: package
revision selection is a historical snapshot, and each adopted project continues
its ordinary append-only revision sequence from that selected moment.

## Scoped encoded appearance disposition

- **Choice:** Accept the measured fine-line/text softening for the tested balanced
  MP4 static compositions while retaining exact selection, geometry and timing
  gates. A pointer still lands on the intended target; its thin colored trail may
  soften through lossy encoding. Agents can choose explicit settings for another
  tradeoff. This does not accept motion playback or speech quality by implication.
- **Gap:** The plan allowed documented codec error but did not prescribe a universal
  numeric color threshold or a perceptual loss cutoff. Earlier experimental
  thresholds had been treated too broadly as unfinished feature requirements.
- **Reach:** Closes06/15's named contracts using complete retained evidence and
  independent critique; failed diagnostics remain failed.16,24 and final acceptance
  keep their own boundaries. No source or renderer behavior changes.
- **Verdict:** Sound: measured loss is compatible with the user's balanced policy
  and does not conceal a demonstrated edit defect. Reversible through explicit
  encoding settings. **Confidence:** Medium, because acceptable loss depends on
  content and viewing conditions beyond this corpus.

## Public prepared audio

- **Choice:** Require an explicit revision for `audio.prepare`, returning the
  shared job state and a retained audio asset. If an agent edits the project while
  a preparation runs, polling the old selection still means the original recipe;
  it never quietly switches to the new head. The existing queue keys that work,
  so there is no additional request-intent table.
- **Gap:** The storage prerequisite required public consumers but did not name
  their entry point or define whether a missing revision follows current state.
- **Reach:** Existing job retry/cancel and asset/audio/acoustic inspection consume
  the result. The initial command names only the verified full processed output
  domain; it does not imply arbitrary target preparation or accepted DSP.
- **Verdict:** Sound: explicit pinning and reuse of existing owners keep the API
  small and retries predictable. **Confidence:** High.

## Transcript-seeded text

- **Choice:** Preserve the original selected word evidence separately from edited
  caption text. If an agent creates a caption from a spoken phrase, then corrects
  its spelling or deletes the original occurrence, the caption still records
  which retained transcript words it came from. New evidence must match the
  pre-edit occurrence; inherited evidence can outlive that clip. Package adoption
  verifies that origin against retained history rather than requiring the clip
  to remain in today's timeline.
- **Gap:** The plan separated display corrections from source transcripts but did
  not specify the lifetime of the original occurrence reference after deletion.
- **Reach:** Existing revision references retain both source resources and the
  exact transcript generation; no second occurrence store is introduced.
- **Verdict:** Sound: provenance describes the origin without pretending corrected
  text is unchanged source speech. **Confidence:** High.

- **Choice:** Allow exact fractional endpoints when placing text. A caption seeded
  from a word in a retimed clip may start between integer microseconds; storing
  that fraction preserves the existing composition clock instead of rounding the
  word boundary. Ordinary text placement accepts the same exact anchor shape, so
  the convenience operation does not need a private edit format.
- **Gap:** Early authoring inputs used integer project/content times, while the
  accepted composition model and projected word occurrences already used exact
  fractions. Transcript seeding exposed that mismatch.
- **Reach:** Text placement becomes more expressive; other movement and media
  placement input contracts stay unchanged. The shared compiler still owns time.
- **Verdict:** Sound: one public edit representation preserves exact authored
  placement through retiming. **Confidence:** High.

## Independent codec invocations

- **Choice:** Keep fresh AAC decode/resample comparisons as visible reproducibility
  measurements while testing mixer arithmetic exactly against frozen decoded PCM.
  When two separate invocations differ by one Float32 step, that alone does not
  identify whether decoding, conversion or mixing caused the difference. The
  original failed comparison remains unresolved; no replacement tolerance or
  whole-composition acceptance is inferred from the frozen-input control.
- **Gap:** The new mixed-rate probe initially invented an exact comparison across
  independent lossy-decoder invocations without separating that claim from exact
  arithmetic on identical inputs.
- **Reach:** Existing MP3 exact gates and AAC source bounds remain unchanged.
  Resampled AAC reproducibility needs its own localization or explicit contract
  disposition; a later green arithmetic test cannot erase the earlier failure.
- **Verdict:** Sound for this scoped checkpoint, with medium confidence: separating
  claims avoids attributing an unexplained difference to the wrong owner, while
  retaining the failed claim as unfinished work.

## Input discovery annotations

- **Choice:** Remove readOnly annotations when exporting caller input schemas.
  An agent creating a gain curve must supply its keys even though the engine
  freezes the parsed array internally. Advertising that field as read-only
  confuses those two meanings. CLI help and MCP tools/list share the same export
  override; runtime freezing, required fields and semantic validation stay intact.
- **Gap:** The schema library exports runtime immutability as an input annotation,
  even when asked for its input representation.
- **Reach:** Schema-driven agents can author all advertised input fields without
  learning a special exception for arrays. Immutable provenance rules remain
  enforced by edits and are not changed by a discovery annotation.
- **Verdict:** Sound: the public description matches what callers can submit,
  using the existing single discovery owner. **Confidence:** High.

## Fractional native audio execution

- **Choice:** Keep fractional-rate audio importable, but refuse its execution until
  the native decoding path can preserve source phase across seeks. Validate actual
  format rates before integer conversion rather than rounding them silently.
- **Gap:** Asset admission allowed fractional metadata, while the execution clock
  used integer rates without an explicit supported-domain boundary.
- **Evidence:** A declared44100.5Hz impulse fixture preserves full-render spacing
  but shifts a late public window. The shift already exists in AVAssetReader output
  before the second converter. An offset patch would hide a seek-dependent defect.
- **Reach:** One SourceTrack rate validator governs execution. Source layout
  restrictions and composition discrete-two-channel index mapping stay separate.
  Audio/movie recipe identities advance; prepared recipes inherit the audio
  executor identity so prior ready results cannot satisfy a new request.
- **Verdict:** Sound with high confidence for explicit refusal; fractional-rate support and broader decoder quality
  remain unproven. Asset admission and retained original provenance are unchanged.

### Sparse captured-PCM proof: retain exact phase failure (sound, scoped)

The offline storage experiment caps requests at eight runs,30 seconds and16 MiB
input, keeping whole-file hashing and platform composition metadata bounded. These
are experiment bounds, not production recording limits. It takes explicit
probe-known frame addresses and requires a supported exact common timescale. It refuses unsupported rates/scales
rather than rounding. This is not a new capture journal or a promise for all device
clocks. The rational container succeeds while the existing reader still moves a
sample; that red remains a separate prerequisite. Packed files remain immutable
experiment inputs, not a decision to retain duplicate production originals forever.


### Captured time: raw-clock equality superseded by admitted placement (corrected)

The 20b/c implementer required every raw host nanosecond plus native frame duration
to survive canonical MOV exactly. This exceeded the public microsecond/source-sample
contract and can exceed the platform timescale. The corrected requirement is one
declared CaptureClock admission policy, exact raw provenance retained separately,
and canonical preservation of admitted sample identities, addresses and support.
A fixed initial microsecond phase with deterministic native-sample classification
is approved only as a candidate to test. It must preserve omission, grouping,
explicit support, pause and window/resampling behavior before rollout; no hidden
fitting, epsilon merging or reader-specific timeline is authorized. This supersedes
the earlier raw-PTS equality/coalescence and raw-through-MOV requirements, while
keeping accepted-versus-durable and canonical publication invariants unchanged.
Verdict: earlier requirement unsound; corrected observable property sound, high
confidence. The initial policy's equivalence remains unproven, not silently adopted.

### Frozen learned native parity: isolated dependency before runtime adoption (sound, scoped)

The fixed RNNoise frame adapter lives in an isolated native dependency package
until the existing audio owner can consume it with an accepted state/channel
contract. This avoids making every app build compile a large model or require
model staging before public adoption. The runtime slice will link this same
library directly; it is not a second renderer or queue. Confidence is high for
this prerequisite boundary, not for unimplemented runtime policy.

Unchanged small upstream source/header files and their notice are vendored;
the large generated model source is explicitly extracted from a hash-verified
local frozen archive into ignored build storage. No download or weight conversion
occurs. This keeps parity tied to the winning bytes without committing a large
trained model or implying public distribution readiness. Broader build/model
preparation remains an explicit runtime-adoption gate.

The streaming adapter delegates selected-domain identity and transactional output
publication to its caller, while retaining one state across arbitrary read chunks.
It rejects unsupported format, invalid reads and nonfinite scaled samples, and
propagates cancellation/read/write errors. It adds no editorial strength/channel
policy, source decoder or automatic quality acceptance. Confidence is high in
this narrow ownership split; the public target/state contract remains open.


### Candidate PCM ties and accepted-state boundary (sound, provisional)

In the bounded 20b prototype, a time halfway between native sample positions rounds
away from zero, matching the existing microsecond boundary rule. The fixed phase
is established only when the accepted-buffer method is called; skipped appends do
not call it. This avoids a failed first buffer silently becoming the reference
for later captured audio. Actual append/journal transaction wiring is still a
required integration gate. Confidence is medium for the candidate as a whole:
its native tracer passes, but public support projection, resampling and recovery
must be judged before production adoption. No per-reader correction is authorized.


### Native stretch parity: complete buffers stay an explicit checkpoint bound (sound, scoped)

When the agent asks this native adapter to stretch selected audio, the adapter
holds the selected input and result in memory because the pinned upstream exact
algorithm needs both. The parity checkpoint keeps the research60s mono48k bound;
it is not a new product duration limit. Cancellation is checked before and after
the synchronous call, so a canceled result is refused but the algorithm cannot
stop mid-call. Public integration must solve longer inputs and cancellation
without silently changing the verified recipe. Confidence is medium for this
bounded prerequisite, not a claim that it is the final public execution policy.
The [checkpoint decisions](assets/13b-native-stretch-parity/choices.md) retain
source ownership, refusal and feedback boundaries; no new renderer or queue owns
this adapter.

### Retain accepted media before journal writes (sound)

When the media writer accepts the first audio buffer but the journal cannot write,
the recorder now remembers that accepted buffer and finishes its container. It
still stops with JOURNAL_FAILED and claims no acquisition for the unjournaled
buffer. Previously its zero counter caused finalization to cancel those bytes.
The plan required truthful accepted state; the bounded verification choice is a
real process-local filesystem limit rather than a test-only production failure
hook. The opt-in offline test restores limits before inspecting retained media.
This adds no persistent format or new recording path. Confidence: high; both first
journal boundaries preserve exact decoded input PCM while recovery keeps support empty.

### Native sample addresses survive rounded decoder timestamps (sound)

When an agent requests a later excerpt, the reader now keeps the physical run's
sample origin and counts samples from it. A platform timestamp can describe two
different returned payloads, so it cannot identify the sample by itself. The
decoder seeks to a provably interior point of the selected sample cell; this
changes neither authored placement nor acquisition support. The
[reader decisions](assets/08-native-sample-address/choices.md) cover bounded seek,
continuity checks and cache invalidation. Confidence: high; this avoids a fitted
offset or a new restriction on ordinary integral-rate audio.

### Packed mapping evidence is not acquired source support (sound)

A schema2 journal may say that an audio buffer was accepted even when its last
physical bytes never reached a usable container. Its new streaming consumer exposes
those mappings only to the future materializer; ordinary inspection refuses that
layout until canonical publication proves which prefix is represented. The summary
does not turn mapping records into acquired intervals. This fills the staging gap
between approved format work and later publication without a permissive alternate
parser or packet array. Confidence: high for the staged isolation; actual committed
prefix admission remains an explicit20c/20d obligation.

### Bind recovery to original validated journal bytes (sound)

When a recording gains later lifecycle records, a whole-file hash changes even
though the mappings used to construct an earlier candidate have not. The existing
journal decoder now returns the byte count and hash of its validated prefix to
internal recovery consumers. A candidate can later name those exact bytes instead
of relying on a sequence number or re-serialized JSON. This token stays out of
ordinary inspection and does not claim that mapped audio reached disk. Confidence:
high; it gives20c/20d one provenance owner without another parsing or storage path.

### Stateful clip membership before runtime adoption (sound, scoped)

Instance identity and shared continuity are distinct meanings. Existing globally
unique step IDs still address owned instances; explicit stateKey values mark
shared groups, while absence means independent state. A first split uses its
newly allocated child step ID as the shared token on both pieces, preventing a
detached token owner from reconnecting former siblings on resplit. This reuses the
existing allocator and adds no group registry or ancestor lookup. Tokens still
present in a revision reserve their ID even after the original owner is removed.

One duplicate operation preserves copied siblings' mutual continuity under a
fresh copied-member token, independent of originals and separate duplicate calls.
Ordinary get/set omission preserves metadata; fresh steps cannot manufacture it.
These are explicit editing semantics, not a claim that independent stereo or
rendered processing has been accepted.

The compiler stores current clip inputs/stacks once and derives connected-domain
prerequisites from ordered stateful steps. It never equates prefix configurations
or infers membership from matching adjacent clips. Shared state participates only
where currently enabled; changing that coverage may require new domains. Input
availability remains evidence of missing support rather than authorization to
feed invented source samples.

At completed edit boundaries, incompatible cross-track membership and dependency
cycles detach all shared state on participating changed occurrences with monotonic bounded repair.
Every iteration removes shared memberships on originally changed occurrences; newly exposed violations cannot trigger unchanged retries. This deliberately avoids a minimum-repair search and leaves the consequence in
normal processing receipts. Unchanged occurrences and valid whole-group moves
retain membership. Structural resolution is shared by edit helpers; strict
admission still rejects invalid imported state graphs. No public processing
readiness follows from this pure compiler checkpoint.

### Normalize audio representation at one track boundary (sound)

A microphone buffer can contain the same frames as 16-bit integers or floating-point
numbers. The writer accepted a changed representation but interpreted its bytes as
the first format, losing or inventing frames. Each track now supplies one float32
interleaved representation at its established rate and channel count. Apple's
PCM-only converter changes representation with an explicit identity channel map;
rate/channel changes refuse before append. One current converter is replaced as
needed, rather than retaining a format cache or introducing another timing owner.
The plan left the platform primitive open; packed24 and planar controls supported
AudioConverterConvertComplexBuffer without narrowing representation support.
Removing sourceFormatHint was rejected: controlled outputs were byte-identical to
the failure. Confidence: high for this bounded correction; actual device format
changes and physical capture remain unmeasured.

### Keep the measured platform export for sparse capture (sound)

When a recording has many gaps, the platform export uses more memory for the
separate occupied runs. The largest existing acquisition limit completed with
exact original samples and placement. Continue with that representation,
finalizing audio roles sequentially so their peak memory costs do not overlap.
The plan left the platform mechanism and resource tradeoff open; the measured
cost alone does not establish a violated finalization budget. A custom movie
serializer would create another format owner without evidence that it is needed.
This choice constrains20c implementation, not recording duration or accepted
input. Confidence: medium; one host's measurements exclude platform services and
do not prove every machine's resource envelope. Cancellation must retain the
original payload and journal; this experiment does not authorize cleanup. See
[the retained experiment](assets/20c-platform-feasibility/README.md).

## 15a2b — Parent and window state semantics

**Accepted for pure authoring/compiler validation; runtime quality remains open.**
Parent state spans structural audio children, including internal timeline gaps,
without using unrelated video or amplitude to choose endpoints. Authored activity
and missing-source support remain separate: a source hole is not permission to
reset the learned state or manufacture samples. Existing curve/temporal placement
owns activation, including empty normalized-window intersections.

Range selection starts from the full structural audio tap plan and intersects the
same eligible member's active interval. Each prerequisite expands at its own
ordered prefix. Interval-local edges to earlier stateful steps may be redundant
transitive edges but cannot acquire disconnected components. Current processing
instructions are reused once; each member retains its own input prefix instead of
flattening several recipes into one schedule. This adds no persistent graph owner.

Channel provenance/native preparation is the next gate: two-channel prepared
output does not establish dual mono. Metadata scopes do not enable execution or
replace the retained full policy and listening requirements.

The immutable model's placement owner reuses a weakly held clip lookup, and each
compiler memoizes its own derived state plan. These are disposable indexes of the
current frozen revision, never membership authority or inputs from an old graph.
Whole-domain activation uses the temporal owner's existing range directly; authored
windows still use its anchored placement resolver.

### Compile the fixed denoiser into the worker (sound, medium confidence)

For local denoising, build the already verified fixed model into the existing
worker after explicit hash-checked preparation. An agent editing a clip then uses
the worker's compiled model identity and never triggers a model download. The
plan required deliberate build adoption but left packaging mechanics open.
Keeping the earlier isolated package optional would add feature-selection
machinery; converting weights for runtime loading would require another parity
proof. Neither is needed merely to preserve the temporary isolated build.
The ordinary build must explain missing preparation before opaque compiler
failures. Native linkage/parity and distribution provenance remain explicit
gates in [15a2](slices/15a2-denoise-prepared-consumers.md); this decision does not
claim those gates passed or authorize publishing a distribution.

### Journal inode owns publication exclusion (sound, scoped)

Use the existing take journal inode as the kernel flock owner, with close-on-exec
and pinned directory/file identities. Process exit releases ownership without a
PID registry or stale-lock cleaner. Exact-prefix replay shares the bounded journal
decoder and validates its byte digest before callers accept staged work. Later
appends cannot expand a pinned recovery attempt. Ordinary schema1 writing holds
the lease already; canonical publication, retry continuation and schema2 adoption
remain separate gates. [Evidence](assets/20d-journal-lease/README.md) includes actual
contenders and exec inheritance with a failing negative control.

## 15a2c — Input provenance before native binding

**Accepted initial admission boundary; full native/channel policy remains open.**
Stored probe channels/rate travel through the existing normalized audio stream and
selected state inputs. Unknown provenance stays unknown; stereo output does not
prove dual mono. Mono duplication, common scalar gain, authored silence and mixing
preserve the intended channel relation, but actual native opening must verify that
premise before DSP execution. Other channel-changing prefixes are not assumed safe.

Consumed support is exact, including prerequisites outside the requested output.
Selected missing support blocks new learned processing instead of being padded;
retained reads keep their existing independence from live processor availability.
File binding and prepared resource retention share the same media-input union.
Actual learned publication/retention proof remains with native integration, not a
fake successful backend or a test-only exported dependency collector.

### Retain working audio when accepted frames are missing (corrected, sound)

During20c/20d integration, the earlier cleanup proposal allowed deletion when all
decodable frames were represented even if the journal said the writer accepted
more. For example, a take could report120000 accepted frames but expose only96000
decodable frames. Copying those96000 exactly does not resolve the missing tail.
The original plan already required preserving uncertain recoverable evidence,
so automatic cleanup now requires all three counts to agree and complete indexed
decode without an unresolved tail diagnosis. A useful canonical prefix may still
be published while its working input remains retained. This corrects the earlier
non-strict count condition; it adds no forensic container parser and does not
claim knowledge of arbitrary unindexed bytes. Confidence: high. The publisher's
retention tests must cover both accepted-beyond-EOF and unjournaled physical tails.

### Verify complete audio through bounded reader batches (sound, medium confidence)

A highly fragmented recording made one giant native reader spend tens of seconds
opening before cancellation could be checked. The canonical verifier now reads
small batches of occupied runs through the same native decoder, carrying one
continuous sample hash across them. Every sample and global placement still has
to match; batching bounds working setup rather than shortening the recording.
Whole-file descriptor verification explicitly selects streaming in the existing
input owner, while ordinary inspections retain their original byte budget.
The proof's byte identity and placement identity are separate and include the
fixed format: regrouping callbacks cannot change the meaning of identical audio.
The [reviewed materializer choices](assets/20c-materializer/choices.md) retain the
encoding and ownership details. These internal choices enable cancellation and
immutable long-file verification; they do not remove public deadlines, establish
a new recording cap or claim forensic knowledge of unindexed container bytes.

### Keep unfinished publication attempts private and inspectable (sound, high confidence)

In the canonical publisher checkpoint, a stopped export keeps one private folder
per audio role. Its intent names the exact input, and its prepared receipt says
which verified output may be published. A partial candidate can be rebuilt before
that receipt exists; after it exists, retry must verify the same candidate. This
fills in the proposal's on-disk restart boundary without a second job manager.
Small metadata records have a fixed size budget because sample placements remain
in the journal, rather than being copied into each receipt. The budget is not a
recording length limit. If cleanup encounters an unexpected file in the attempt,
it retains that file and reports pending cleanup instead of deleting the folder
recursively. A successfully published recording stays available throughout. These
choices make future stop/recovery continuation reuse the same inspectable attempt.

### Stream learned state through one attempt-owned PCM spool (sound, medium confidence)

When a short preview needs an earlier learned-processing prefix, the compiler
supplies one shared set of current inputs and ordered prefix references. Native
execution uses the ordinary mixer to write each complete component into one
reusable input file, then calls the fixed adapter and appends its output to one
attempt-owned file. This trades temporary disk I/O for memory independent of
recording length and avoids an asynchronous-to-synchronous thread bridge. Nothing
is published until counts agree; cancellation belongs to the existing render
attempt and prepared job. There is no second prepared cache, job queue or project
graph. Components with no output samples do no inference.

### Bind the compiled recipe through observed native metadata (sound, high confidence)

At service startup, one bounded native metadata request identifies the compiled
recipe for both audio and movie consumers. If that request is unavailable or
malformed, new learned preparation remains unavailable while ordinary authoring
and retained PCM reads remain usable. Availability is fixed for that service
instance because the model is compiled into its worker; replacing the worker
requires a restart. The existing render deadline includes the complete selected
state components as well as requested output, so a short preview does not budget
only its visible duration. This neither creates a runtime model installer nor
claims that an unavailable capability removes weights from the linked binary.

### Verify imported source clocks against the media they describe (sound, high confidence)

During canonical package admission, a package could keep every audio byte unchanged
but shift its claimed starting time and matching binding by one microsecond. File
hashes alone therefore could not prove that playback would use the verified clock.
Publication-backed audio now uses the existing native probe on its admitted file
handle to confirm the stored media facts before acceptance. Both temporary package
inspection and durable adoption regenerate journal evidence and rebuild bindings
through the same owners. A package cannot select a weaker check by claiming an
older journal layout. This fills in the original canonical-only admission contract;
it does not change the policy for unrelated imported asset types. Package readiness
now requires this native verification work, whose large-work deadline remains an
explicit rollout gate. [Admission choices](assets/20d-canonical-admission/choices.md)
retain the workspace and legacy-rounding boundaries.


## Capture stop continuation (20d)


## Sound — medium confidence

**Availability and cleanup have separate outcomes (20d stop continuation).** When
canonical media is already verified and published but removing working files fails,
the take remains complete. CaptureResult carries optional cleanupFailure rather
than mislabeling it as a failed capture. An original capture failure still wins.
The plan required this distinction but did not choose its result shape. Keeping the
warning on the existing result avoids a parallel volatile warning owner; recovery
owns an explicit cleanup retry. Root reviewed this contract. No endpoint is added.

## Sound — high confidence

**Repeated stop returns its authored acknowledgment while completion is being
reported (20d stop continuation).** If media finishes while the terminal report is
waiting for service acknowledgment, the controller retains the earlier finalizing
receipt rather than manufacturing finalizing with the newer terminal sequence. The
plan did not specify this interleaving. This preserves one meaning per sequence and
lets the terminal report win normally; it adds one transient receipt to the existing
controller rather than another state machine.

**Cancellation transfers to the existing native termination task (20d stop
continuation).** A cancel can arrive while the controller's first finalizing report
is held, before native stop has created its task. NativeCapture retains that request
only for an existing packed sink, transfers it when the task starts, and clears it
for a new take. Otherwise the cancellation disappears and expensive publication
runs despite the user's request. A cancel after availability settles remains optional
cleanup cancellation. The plan named the owner but did not specify this await gap.
There is no new task registry or transport-triggered cancellation.

**A lost start response can advance directly to native-proved finalizing (20d stop
continuation).** The library may still say preparing when native has captured and
received stop. Its actual finalizing event is accepted with the same identity and
sequence checks; no invented recording event fills the missing response. Otherwise
recovery could inspect a still-owned writer and permanently override its later
completion. The old transition table left this legitimate state jump unspecified.
Root approved the change; public terminal duration still comes from native outcome.
### Learned portable preservation oracle

- **When:** 14a learned prepared-package checkpoint.
- **Choice:** Compare the receiver with the donor's actual publicly delivered
  learned PCM. A package should preserve the sound already prepared: exporting,
  adopting and reading it must not run the denoiser again or change its samples.
  The earlier frozen-adapter comparisons remain the separate proof that the
  denoiser computes the accepted recipe; this transfer pass does not replace them.
- **Gap:** The package follow-up did not prescribe a second DSP oracle.
- **Reach:** Reuses the existing package and prepared-audio harness with a short
  generated stereo fixture; does not infer speech quality or long-output behavior.
- **Verdict:** Sound; isolates preservation from execution and retains the earlier
  independent numerical gates.
- **Confidence:** High.

### Independent channel state (sound, medium confidence)

**Sound, medium confidence: fixed independent state for each output lane.** When a project contains different left/right speech or noise, each lane now receives its own instance of the already selected mono algorithm over the same authored state interval. A quiet or opposite-polarity right channel cannot alter the left detector. The existing mixer still maps mono sources into the stereo project rendition; this adds no downmix, linked detector, normalization or channel control. The native identity names the policy so earlier mono-only recipes cannot silently acquire a different meaning. This was explicitly approved as the implementation direction and is now numerically verified; it is not a user listening verdict or a claim that stereo balance is perceptually unchanged.

Paired output remains one transaction in the existing attempt-local spool. Processing lanes sequentially avoids another scheduler and preserves the unchanged synchronous adapter; only complete paired counts expose a component to its dependents. This internal buffering choice keeps the same state graph and prepared publication owner.

### Shared recording-package admission (sound, high confidence)

A portable recording can contain correctly hashed audio while its editable metadata
claims different speech timing. Both package assembly and opening therefore verify
the native publication proof and compare the audio pages that playback actually uses.
Project packages reuse the same proof owner, retaining their own binding checks.
The specification required truthful portable audio but left the shared owner boundary
open. Verification borrows the existing workspace lock into native workers so a
service restart cannot remove their working files. This introduces no second clock,
cleanup owner or ready store. [Detailed decisions](assets/20d-recording-package/choices.md)
record the preserved legacy and deadline boundaries.

### Large compiled plans use the existing render workspace (sound, medium confidence)

A long project can have a small preview yet need a large learned-processing input
plan. Raising the control-message limit would widen every operation. Instead, the
service keeps small composition plans inline and puts larger ones in the render
attempt's private directory. Native reads the same plan fields with the same strict
validator; no second timeline or request meaning appears. The compiler contract left
serialization to implementation. The64 MiB plan bound leaves room above the measured
17.4 MB basic10,000-occurrence fixture while keeping native admission finite; heavily
enriched projects can still refuse explicitly. This is a transport bound, not a
promise that every10,000-clip project fits. Existing attempt locks/cleanup own the file,
and the native file check does not claim arbitrary parent directories are immutable.

### Acquisition recovery waits for native work (sound, medium confidence)

If the service dies during source verification, its native child can keep reading
and writing. Acquisition recovery now takes an exclusive lease on the acquisition
root before deleting files, references or pending rows; native work inherits a
shared lease. The plan required safe recovery but did not select lease scope.
A root lease deliberately delays unrelated acquisition cleanup too, because the
existing recovery transaction spans the whole owner, including reservations without
files. Startup reports retryable ACQUISITION_BUSY instead of polling or deleting
live work. Once the child exits, ordinary recovery proceeds. This reuses the existing
directory and adds no lockfile registry. Package verification carries both its input
workspace lease and acquisition staging lease because they protect different files.

### Canonical verification gets its own work budget (sound, medium confidence)

A sparse recording may hold little PCM while its many segments take a minute to
verify. Source normalization now gets a ten-minute canonical segment allowance plus
the existing byte-work budget. The gap was how asynchronous verification should be
bounded; this is an observation policy grounded in the measured100,000-run workload,
not a universal throughput promise. Legacy sources retain their old worker deadline;
control messages and public client waits are unchanged because preparation is a job.
Cancellation still drains the worker. Larger probe responses and physical metadata
row limits are separate failures; extending a timer does not make those imports work.

### Advance execution identity when a refused domain becomes supported (sound, high confidence)

A project that failed an older native size limit has a nonretryable job, so retry
cannot repair it after updating the renderer. Audio/movie execution identities now
advance with the expanded transport and scheduling capability even though sample
meaning is unchanged. A new preparation request for the same revision gets a fresh
recipe instead of reusing the old refusal. The earlier transport pass did not account
for persistent failures; the owner regression now demonstrates that boundary. This
can recompute previously ready recipes requested anew, but saved audio assets and
historical publications remain intact. There is no metadata migration or change to
the fixed RNNoise model recipe.
### Active audio scheduling and scale evidence

- **When:** 24b active-audio prerequisite.
- **Choice:** Apply the decoder budget to simultaneously readable occurrences,
  rather than every clip saved in the timeline. A project can play thousands of
  short clips one after another without opening thousands of readers. Overlapping
  clips still consume the existing bounded reader budget; structural plan bounds
  separately limit metadata. The same mixer decides both ordinary and learned
  prefix work, including prepared output that continues across source silence.
- **Gap:** The declared 500/10,000-occurrence workload exceeded the prior whole-plan
  limit; the plan did not prescribe the admission/scheduling repair.
- **Reach:** Allows long sequential timelines without a new mixer or cache. It
  does not admit unbounded simultaneous readers or guarantee deep-graph latency.
- **Verdict:** Sound; bounds the resource actually consumed while preserving
  earlier numerical, routing and cancellation contracts.
- **Confidence:** High.

### Retain both source-generation and recording lifetime (sound, high confidence)

When the service dies while a native reader continues, the restarted service cannot
use its own job list to decide that files are unused. The reader now holds an
operating-system lock on both its temporary generation and the recording root.
Cleanup may remove unrelated abandoned generations, but must preserve the held one;
whole-recording deletion must wait for the broader root lock before purging files
or evidence. Native deletion children inherit that authority too. These are two
different deletion scopes, sharing the existing file-owner lock primitive rather
than a new process registry. The plan required safe recovery but left these orphan
lifetimes unspecified. Busy outcomes are retryable; explicit retry after the child
exits completes cleanup. An already-missing root still permits deletion recovery.

### Resolve independent placement runs once (sound, high confidence)

The atomic editor now groups contiguous project-anchored placements only when no
processing normalization is present. It reuses the existing resolver and placement
construction; failed runs locate the earliest invalid prefix so error ordering and
receipts remain those of sequential edits. This is narrower than a lazy mutable
model/cache, which would need invalidation and intermediate-validity rules across
all edit kinds. Exact frozen scalar comparisons and original large receipt identity
support the choice. The public deadline remains unchanged. The separate duplicate
public-document/MCP response-size failure is not counted as fixed by faster edits.

### Deliver bulk probe metadata through the attempt owner (sound, high confidence)

A heavily fragmented recording can have a small media file but a metadata description
that exceeds the command-response frame. Native probing now writes that same description
to its caller's temporary file and returns a length and digest. The service checks the
file before applying its existing metadata schema. This keeps one metadata producer
and one decoder, using the existing attempt cleanup and inherited locks. Caller file
descriptors retain their numbering before hidden lifetime descriptors are appended.
The plan left bulk delivery unspecified; the measured object fits a separate64MiB
payload budget, which bounds accepted bytes rather than native framework allocations.
Ordinary media path admission stays unchanged, and direct native callers may still
request inline metadata. Physical row limits and public/package delivery need their
own verification; larger global control frames would not solve those contracts.

### Count physical gaps in asset capacity (sound, high confidence)

A recording with100,000 occupied runs can also have99,999 gaps between them plus
one gap at each edge. The shared asset schema therefore admits up to200,001 physical
rows, retaining gaps exactly. The previous100,000-row cap confused physical rows
with occupied support and rejected an otherwise admitted recording. This applies
to the common import schema, with no canonical-only exception or dropped rows.
It changes metadata admission capacity; public page and package budgets remain
separate. Measured parsing and persisted round-trip work support this bound, without
claiming a universal memory limit for native probing.

### Public revisions own the committed document (sound, high confidence)

Public edit results no longer repeat the full document inside their operation
receipt. The same canonical projection applies to newly produced and saved results;
old persisted bytes are not migrated or executed again. This preserves committed
identity and result meaning while intentionally changing developmental response
shape. Full historical byte equality across this release is not a contract. MCP's
standard text/structured representations remain, and actual 10,000-clip delivery
fits existing bounds. This fixes redundant ownership instead of increasing global
response limits or inventing a second receipt protocol.

### Public job status identifies rather than embeds execution recipes (sound, high confidence)

The existing public status owner returns a SHA-256 of exact stored input bytes
instead of copying the serialized execution plan. This preserves queue identity,
retry/cancel behavior and publication while allowing declared large projects to be
inspected under existing transport limits. Raw recipes remain internal. Test-only
recipe comparisons read the catalog and authenticate against the public digest;
there is no product escape hatch. Full-input query work remains, explicitly outside
this delivery correction's claim. A cache or global frame increase was unnecessary.

### Store physical segments once behind indexed pages (sound, high confidence)

An agent inspecting a fragmented asset now reads stream summaries, then requests
ordinal pages of physical segments. Every asset uses that same public shape.
Keeping the segments inside one JSON string forced even a small page to parse the
whole recording and reached about1GiB in the measured traversal. AssetStore now
stores those rows once in an indexed table; the metadata header keeps only array
presence so complete internal reads can reconstruct optional-versus-empty fields.
Import and portable adoption commit the header and rows together. Shared admission
refuses duplicate stream identities before they can alias rows. The plan left
bulk representation unspecified; this choice keeps one authoritative owner and
bounds page work without a second cache. Catalog15 identifies this layout, and the
subsequent capture column change must use the next version rather than reusing15.
Old layouts are explicitly refused; no history migration is introduced.

### Preserve independent scale evidence through lossless reconstruction (sound, high confidence)

The complete two-hour delivered WAV remains stored, while duplicate lane oracle
files are reconstructed from retained unmatched prefixes and byte-preserving
channels, and exact repeated input periods reconstruct source input files. Original
independent file hashes were captured first; archive decompression and all four
materialized restoration hashes were verified before reclaiming duplicates. This
reduces storage without selecting favorable samples. Restored evidence is not a new
independent oracle, and the original execution/provenance remains retained. No new
product store or audio representation is introduced. Concurrent-load timings and
successful-path cleanup retain their stated limits.

### Separate authored upstream truth from the learned oracle (sound, high confidence)

The combined public fixture uses known retained samples, exact source offsets and
held binary gains to predict upstream PCM without the renderer's curve/mix logic.
Only after the delivered prefix matches does the frozen C adapter judge RNNoise.
This prevents two paths sharing a wrong prefix from certifying each other. Held
transitions bound this proof; existing interpolation contracts and later listening
judgments remain separate. One shared test reference runner retains the recipe and
raw files for both native/public harnesses, without adding a production audio owner.

### Keep unfinished recovery in the capture lifecycle (sound, high confidence)

When a take stops but publication still needs minutes, CaptureService retains one
owned cancellable attempt and returns finalizing promptly. The recording stores a
bounded error when that attempt fails; reads preserve it, explicit retry clears it
when work begins, and terminal state clears it. This implements slice 20d1 without another
job registry for a take whose revision does not yet exist. Catalog version 16 identifies the
added field; older layouts are refused under the existing development policy.
The plan required durable failure but left the concrete lifecycle storage open.
This gives control, restart and deletion one owner rather than a parallel tracker.

### Give canonical recovery a finite work allowance (sound, medium confidence)

A very fragmented take may require much more work than its duration suggests.
Canonical publication receives a 20-minute fragmentation allowance plus the existing
byte-based allowance, capped by the media-worker maximum. Control calls still return
promptly. The observed 100,000-run recovery needed about 254 seconds; this allowance is
conservative rather than a universal performance guarantee. Expiry keeps source bytes
and reports a retryable failure. The plan required fragmentation-aware budgeting but
did not specify this allowance; later scale evidence may revise it without changing
editing semantics or global client deadlines.

### Share source support only within one validation (sound, high confidence)

When many short clips use one fragmented source, the model now computes the shared
source/acquisition intersection once for that validation, then selects only the
intervals each clip touches. A different acquisition keeps a different intersection.
Freezing the result visits shared objects once. The scale plan left the optimization
mechanism open; keeping this index local avoids a long-lived cache or invalidation
policy, while preserving every selected interval and exact rational boundary.

### Hydrate complete project metadata before readiness (sound, medium confidence)

A project with many fragments and a long undo history can exceed the manifest and
control-message budgets even though its media files are small. Project package
version 2 stores every existing typed resource and revision as a hashed inventory
member. The same admitted file owner reads and validates them before readiness;
recording packages keep their existing contract. A shared 128 MiB serialized JSON
budget covers the whole selected history and all resources, with explicit refusal
rather than partial history. The plan left the expanded metadata representation and
working-memory ceiling open. A near-limit resolver measurement stayed below the
existing 4 GiB memory target, but unlimited lazy metadata is not implemented. Version
1 project packages are explicitly refused under the unshipped-format policy.

### Index compact export status in SQLite (sound, high confidence)

Polling an export should not read its complete large execution snapshot. The export
owner now uses one covering expression index containing the derived summary and
small lifecycle fields; listing first selects a bounded ID page and then looks up
those summaries. The original snapshot remains authoritative for execution. The
plan did not prescribe status storage. SQLite maintains this derived index without
a second registry, at a measured cost of recomputing it on lifecycle changes. This
trades infrequent write work for bounded repeated reads; video and recording status
settings remain complete.

## 24h — Compact job inspection

### Store a short recipe fingerprint for job lookup (sound, high confidence)

When an agent polls a large render, the job may contain a many-megabyte recipe.
The queue keeps that complete recipe for execution, but stores its SHA-256
fingerprint once for lookup and status. A fingerprint is a short identifier
computed from the recipe bytes. When admitting or publishing a result, the queue
still compares the complete recipe and refuses a fingerprint collision. Polling
uses the established write invariant instead of reading and hashing the complete
recipe again. The scale plan left the lookup mechanism open; this replaces large
identity indexes without introducing another job registry or losing exact inputs.

### Check owner existence without loading its media plan (sound, high confidence)

A status request needs to know whether the job's project revision or asset still
exists. It now checks that exact retained revision under a nondeleted project,
or the asset row, without parsing the revision document or its physical media
segments. Execution and admission retain their full validation. The plan required
truthful status but did not prescribe its database reads; this keeps repeated
inspection bounded without weakening the checks that produce or consume media.

### Keep export recovery ordered through its own compact index (sound, high confidence)

After a restart, exports must find their attempts in the existing recovery order.
The database retains a partial index containing only those exports' bounded
identity and attempt keys. Its exact joins use the same deterministic fingerprint
helper as the queue. This avoids rebuilding huge general recipe indexes or adding
a separate recovery registry. The plan left the index shape open; ordinary job
inspection becomes cheaper while export retirement keeps its existing ordering.

### Identify the changed development catalog explicitly (sound, high confidence)

A library created by this version stores the new recipe fingerprints and indexes
under catalog format17. An older incompatible development library is refused
explicitly rather than modified in place. The project already requires this
unshipped-format policy; applying it here prevents old binaries from interpreting
new storage incorrectly. Complete execution recipes remain durable. This format
change does not establish that all history and execution work is bounded.

## 24i — Independent processing updates

### Validate independent stack changes together (sound, high confidence)

When an agent replaces stacks on many distinct existing targets, the editor now
constructs those stateless updates in order and validates their combined document
once. Repeated targets, symbolic dependencies and any RNNoise state retain the
ordinary sequential path. This changes the work performed, not which edits are
allowed. The plan left batching eligibility open; a narrow rule preserves state
normalization and prevents a later edit from hiding an earlier invalid operation.
Both paths share ID allocation, stack construction and composition validation.
The earliest failing prefix and each operation's frozen receipt remain observable.

### Reproduce a timed-out edit without deleting its receipt (sound, high confidence)

The original large request timed out and later committed. To measure a fresh edit,
the verification copies that library and uses public restore to recover the exact
input document. It then sends the same operations with the new revision and request
IDs required by that restore. The original receipt remains intact and supplies the
complete expected result. The plan left fixture reset mechanics open; this avoids
direct database rewrites while preserving honest replay and latency evidence.

## 20d5 — Recording-owned work without a video revision

### Keep cleanup work under the recording's existing owner (sound, high confidence)

An interrupted recording may retain audio but have no playable video revision.
Its source-owned jobs now explicitly use revisionId:null; ordinary requests that
omit the revision still select the current revision. The recording's existing
cancellation and deletion ownership applies to both. The plan required cleanup
of these recordings but left the job representation open. Reusing the existing
nonrevision storage value avoids inventing a revision or a second job registry.
Catalog18 identifies this changed interpretation; project jobs remain revision-bound.

### Expose existing job controls in the recording service (sound, high confidence)

An agent could previously inspect jobs in the isolated editing service, while the
recording service refused the same commands. It now routes inspect, retry and
cancel directly to its existing queue. Cancel waits for the existing worker-drain
budget; inspect and retry remain short calls. This makes source-owned work
manageable through the shared public API without adding a new continuation system.
The actual cleanup operation remains a separate implementation checkpoint.

## 22b — Consume retained project output

### Reuse a recorded result only when its full recipe matches (sound, high confidence)

Moving a prepared project should not require rerunning its original processor.
The prepared owner compares the selected revision's complete audio recipe with
the saved recipe, keeping recorded model, state, upstream and rendition identities.
Equivalent references to the same policy and bytes count as one result; distinct
matching policies report ambiguity instead of choosing whichever is newest. A
broken matching result remains an error. The plan left candidate selection open;
this permits offline playback without inventing a new processing policy.

### Pin produced or retained audio when work is admitted (sound, high confidence)

If an export starts before preparation finishes, it keeps its produced-audio
choice even when a retained result arrives while it is queued. A retained choice
instead pins that exact resource. This prevents later publications from changing
job meaning. The plan required immutable jobs but left this consumer representation
open; an explicit internal null means produced, a resource ID means retained.
The native reader borrows the validated file descriptor and passes bounded PCM
blocks to existing WAV/movie writers, with no new decoder or resampler.

## 20d6 — Explicit verified cleanup

### Reclaim one recording through its existing jobs (sound, high confidence)

When publication succeeds but working files remain, the agent requests cleanup of
that named recording. The existing queue owns retry, cancellation and deletion
draining; the native publication owner alone authorizes file removal. No startup
scan or automatic retry is added. The plan required explicit recovery but left
its operation shape open. Repeated requests join the same source-owned job, and
ready source evidence is independent of that job's cleanup outcome.

### Report retained files as an explicit result (sound, high confidence)

A successful inspection may find files whose mapping or publication proof is
incomplete. Its result says retained rather than claiming all files were removed.
Missing journals also retain media. Changed proof is a final conflict; positively
identified access and ownership failures are retryable. The plan left the result
shape open. This distinction lets agents act on uncertainty without deleting
recoverable media or retrying malformed proof as though it were a transient fault.

### Reuse the canonical verification work allowance (sound, medium confidence)

Cleanup can recheck an entire fragmented take before unlinking small working files.
It receives the existing20-minute canonical fragmentation allowance plus the
byte-based publication budget, capped by the media-worker maximum. The request
itself remains asynchronous. The plan required bounded cancellable work but left
this budget open; using the measured recovery allowance avoids a short control
timeout without introducing an unbounded cleanup worker.

## 20d7 — Terminal diagnostic ownership (sound, medium confidence)

When a capture fails before usable video exists, the agent still needs to learn
why. Store one nullable message beside the recording's existing interruption code,
so ordinary status reads work without a revision or a journal scan. The plan
required disclosure but did not choose storage. This adds one catalog column and
extends existing reports and snapshots; it adds no endpoint or background task.
The choice is sound because the recording already owns terminal state and survives
restart independently of media processing.

## 20d7 — Historical receipt verification (sound, high confidence)

An older exported package can contain a raw failure message that its original
normalized receipt never disclosed. Recomputing with the new reader must still
verify that package. New receipts declare normalization version 2; absence denotes
the original format. Only when verifying that original format, the verifier removes
the newly disclosed message and version before comparing the complete receipt.
It still compares every earlier field and the normalized file hash exactly, and
new-format verification includes the message. The plan required immutable source
preservation but left format handling unspecified. This decision preserves existing
packages without silently rewriting their proofs or broadly ignoring differences.


## 22c — Use the shared resource budget for complete recipes (sound, high confidence)

When thousands of clips produce a multi-megabyte preparation recipe, that recipe
is stored in its own authenticated package resource, not inside the compact
manifest. Apply the already selected128MiB aggregate project JSON budget to its
UTF-8 bytes, retaining the aggregate check across all resources and history.
This supersedes14a's manifest-sized recipe cap now that20d3 has moved resource
metadata out of the manifest. The earlier cap would reject valid editable projects;
truncating their recipes would erase the evidence needed to reuse their audio.
No new memory budget, storage owner or package format is introduced.

## 20d8 — Exercise real pause timing with prerecorded input (sound, high confidence)

A deterministic input fixture delivers decoded audio after the recorder has observed
an actual pause/resume interval. It independently removes the offered buffers that
intersect that interval and derives the expected source positions. This tests the
production clock, writer and publisher for both audio roles without recording the
user's devices. The plan required both-role pause preservation but left the offline
fixture method open. The result establishes sample/support preservation, not
physical synchronization or listening.

## 20d8 — Reconstruct interrupted terminal persistence (sound, high confidence)

After canonical media and receipts are durable, a copied fixture omits the final
journal record or retains only its torn prefix. Recovery must retain all media and
report incomplete capture rather than inventing a successful finish. The plan
required the boundary but did not choose the fault mechanism. Reconstructed disk
states directly exercise recovery without claiming an actual process kill or
hardware power-loss experiment.

## 24j — Restore an authenticated checkpoint, not missing history (sound, high confidence)

The original two-hour library was removed, but its successful receipt kept the
complete recipe hash. Rebuild the authored composition from the frozen setup and
accept it only if the full recipe hash matches exactly. Preserve its original
preparation identity and PCM; use the existing adoption owner to assign a new
checkpoint identity and timestamp. Newly authored edits can test undo, but cannot
stand in for missing original history. The plan required full-size transfer without
repeating proved DSP and did not specify recovery from this retained evidence.
This preserves provenance without manufacturing a new execution or old history.

## 24j — Check the test's actual storage peak first (sound, high confidence)

Full export briefly holds four independent copies of the large prepared payload.
The research harness checks that capacity plus a1GiB working margin before
restoring gigabytes, and keeps scratch on the checked output volume. This is a
reversible test safeguard, not a product limit or permission to delete other files.
The plan left research capacity checks unspecified; the exact transfer remains
unverified until enough capacity is available and all real owners run successfully.

## 13a — Familiar full-selection stretch listening material (sound, high confidence)

The user could not interpret unfamiliar short word fragments. Use the same retained
five-second recording selection and inherited transcript as the familiar denoise
comparison for optional speed listening. The two rendered input channels are
byte-identical, so one channel supplies the frozen mono research adapter without
changing sample values. Preserve unity gain and the full selected context, with
clearly labeled speeds. This is a reversible presentation choice; it does not
establish protected-word labels, public stereo behavior or speech quality.

## 15a3b — Denoise strength is an explicit wet/dry mix (sound, high confidence)

An agent may want denoising to enter gradually during a sentence. Give the
existing processor a `mix` scalar using the same keys and clocks as gain:0
keeps its immediate input,1 keeps the learned result, and values between blend
them linearly. This adds control without changing the frozen model recipe.
Keep learned state continuous through zero mix so fading back in does not start
a new acoustic history. The accepted plan required strength automation but left
its parameter and arithmetic unspecified; explicit blend avoids inventing a
model tuning control that the fixed adapter does not provide.

## 24k — Reuse state ownership to batch independent placements (sound, high confidence)

Adding many clips to a project with ordinary gain previously repeated full project
validation for every clip. The existing state owner already distinguishes processors
whose input membership changes shared learned state. Use that same classification
to batch independent placements; keep stateful normalization scalar. This avoids
a gain-only exception and preserves ordered receipts and the earliest invalid edit.

## 24k — Skip sources known to have no published events (sound, high confidence)

Thousands of imported clips may have editorial cuts but no capture or scene
evidence. Their missing source rows cannot contribute events, so skip those lanes
without spending the source-read budget. Keep publication dependencies pinned:
later evidence invalidates the query, and a missing file behind a published pointer
still fails normally. The existing10,000-occurrence bound contains this traversal;
no larger page budget, cache or timeout is introduced.

## 24l — Measure a fresh warm render through publication (sound, high confidence)

A repeated preview request can return a cached movie without rendering. Prime one
window, then measure a different uncached ten-second window on the same long
project, through ready publication; record cache lookup separately. Sample the
existing process peak after movie finalization so the memory receipt includes
encoding. The corpus proves1080p output cost, not decoding1080p source footage.
This measures the existing budget without adding a new endpoint or renderer.

## 24m — Isolate duration from clip count and authoring memory (sound, high confidence)

A longer project often also has more clips, obscuring what caused extra memory.
Keep10,000 identical source selections and the250-row query fixed, changing only
project spacing from two to four hours. Restart after authoring and compare three
alternating fresh-process trials per duration. Report sampled resident peaks and
growth above startup, using medians without hiding individual variation. This
resolves the plan's unspecified measurement method for timeline queries; it does
not establish memory behavior for other query families or native decoding.

## 15a3b — Version produced mixes while retaining old preparations (sound, high confidence)

Adding mix curves changes what the composition executor understands, even though
the learned model itself is unchanged. Advance produced audio/movie identities
tov9/v19 while keeping the fixed model identity. Previously prepared audio keeps
its recorded policy and remains readable through the existing retained-result
owner. Omitted mix preserves the old full-wet samples; its new execution receipt
truthfully identifies the new executor rather than pretending it was the old one.

## 24n — Measure decoding and source reads separately (sound, high confidence)

A 20 ms excerpt can decode few samples while still reading most of its file to
identify it. Report both amounts from their existing owners: native decoded
frames by rate, and successful positional reads/deliveries by the descriptor
loader. Count retired readers once without retaining them. Snapshot loader
counters only for the final public result; preparation's internal results would
otherwise repeatedly scan the same sources. The plan required bounded work but
left the measurement seam unspecified. Explicit unknown reads for pathname and
retained-PCM paths prevent partial telemetry from masquerading as total I/O;
future performance claims must preserve that distinction.

## 24o — Tell the framework when all source bytes already exist (sound, high confidence)

When an agent opens a local clip, the existing loader already has its complete
file. Declare that using Apple's available-on-demand property so metadata reads
can seek directly. Keep the same owned file handle, exact timing and inspection
ceiling. This platform capability fills the plan's unspecified metadata-loading
mechanism without adding a new decoder, pathname lookup or file copy. A direct
file-descriptor URL was rejected because it bypassed that inspection ceiling.

## 24o — Separate metadata repair from unconstrained decoder read-ahead (sound, high confidence)

A short excerpt from a long file needs two different checks: finding its media
metadata and reading its selected samples. Use a sparse two-hour file with known
sample markers to measure early, middle and late reads without allocating or
rendering two hours of audio. Report actual bytes and exact sample comparisons.
The initial 128 KiB test guess ignored the existing one-second physical tail in its
60-second fixture, so its corrected bound follows that tail plus metadata; its
original failure stays retained. The new sparse read-ahead bound is still failed
and remains unchanged. Separate verdicts permit the metadata repair to land
without treating its success as proof of bounded decoder demand. This resolves
the plan's unspecified measurement method, not its open performance requirement.

## 24r — Isolate history size from revision size and authoring cost (sound, high confidence)

When an agent reads one page of edits, a longer history should not require
loading all earlier revisions. Compare 5,000 and 10,000 real revisions with the
same small canvas document, then restart before reading the same fixed 250-row
pages. Generate edits through the real owner in memory and back up its catalog
for public disk-backed reads, avoiding thousands of durable setup commits without
inventing database rows. The plan left the history measurement method open;
this isolates that query contract without claiming arbitrary document-size or
package-history performance. Use three alternating cohorts and preserve sampled
memory/latency distributions instead of equating one fast read with a guarantee.

## 24p — Identify ambiguous audio through the platform parser (sound, high confidence)

A file handle has no useful filename, and an ID3 header can precede more than MP3.
Use known container signatures only to select a path, then ask AudioToolbox to
identify ambiguous audio through positional reads on the already-owned handle.
Use its registered type and suffix for AVFoundation. This fills the existing
loader's format gap without a second decoder or a handwritten tag/frame parser.
Actual packet, rate and channel support remains the audio reader's decision;
ordinary pathname imports are a preservation control, not the original defect.

## 24p — Bound identification even during whole-file streaming (sound, high confidence)

Streaming a long movie may legitimately consume its entire contents, but merely
recognizing a malformed audio header must not scan indefinitely. Require a finite
identification allowance for both modes. Inspection charges sniffing,
identification and subsequent reads to one 64 MiB ceiling; streaming may continue
reading after its bounded identification. The plan did not specify recognition
cost. Making the helper's allowance mandatory prevents an unbounded recognition
path from reappearing, and the parser never changes the caller's file position.

## 24q — End decoding at the demand already computed by its caller (sound, high confidence)

When an agent asks for a short excerpt, its caller already knows the exact native
sample interval, including necessary conversion context. Give that finite end to
AVFoundation rather than an infinite range. Preserve the existing packet
lookbehind and source-time representation; discard any endpoint rounding cell
before conversion. Later adjacent requests first consume reusable pending samples,
then open a new finite reader only when coverage ends. Keep that ordinary
extension separate from the one-time premature-end retry, and let empty requests
leave the physical origin untouched. This resolves the previously unspecified
reader coverage policy without guessed padding, new caches or altered PCM meaning.

## 18a/19a — Port frozen voice bytes without treating parity as listening approval (sound, high confidence)

The user found the main generated voice close and rejected the speaker-only
alternative, but joins and listening acceptance are still unresolved. Preserve
the main candidate exactly. Two fresh offline processes now reproduce the
retained words and phrase without changing any identity or parameter; system
caches remain intact and the reference-origin copies remain the same bytes.
Use that bounded result for a private worker-entry port, as the earlier denoise
entry checkpoint did. Keep public generation and the complete parent acceptance
separate. This resolves whether implementation can progress before listening
without silently choosing a new voice or upgrading numerical parity to quality.

## Private voice entry19a integration

- **Choice:** Treat the prepared environment as an explicit measured input. When
  the agent starts synthesis, the service checks executable, entry and manifest
  bytes; Python checks model bytes, runtime Python sources and dependency versions.
  Other dependency binaries are not authenticated. The alternative would silently
  accept a different installed environment and lose the frozen-output guarantee.
  **Gap:** The plan required preparation identity without specifying its envelope.
  **Reach:** Public preparation must deliberately replace these private pins with
  its common owner, preserving the measured recipe. **Verdict: sound; confidence
  medium.** The scope is explicit and does not promise portable binary identity.
- **Choice:** Admit only short measured references in this private checkpoint. A
  request with more than five seconds is refused before inference; future public
  controls must widen this through measured support rather than inherit it by
  accident. Encoded references are also capped at1MiB and each text field at16KiB.
  **Gap:** The parent did not specify private admission budgets. **Reach:** These
  bounds constrain this entry test, not the final editing workflow or model ability.
  **Verdict: sound; confidence medium.** A bounded checkpoint preserves parity
  while the full public settings contract remains open.

## Voice relocation and public integration plan

- **Choice:** Package the effective Python environment as installed bytes. The
  standalone interpreter uses its adjacent library and the original venv's full
  effective package set; base-only pip and unused activation tools are excluded.
  The model remains a separate verified input. **Gap:** Relocation layout and
  artifact supply were unspecified. **Reach:** This yields an explicit local
  preparation artifact without claiming a downloadable or cross-machine release.
  **Verdict: sound; confidence medium.** Original bytes and exact outputs survive;
  public distribution remains separate work, not an implicit install.
- **Choice:** Keep reference transcripts in frozen generation requests. An agent
  can reuse the same excerpt with different explicit transcripts; each request
  has its own identity. Historical extraction origins remain typed metadata, not
  a second voice library. **Gap:** Parent19 did not fix reference handle shape.
  **Reach:** Ordinary assets and shared jobs own lifetime and replay. **Verdict:
  sound; confidence high.** This supports reuse without another mutable registry.
- **Choice:** Resolve saved generation before installed-model readiness. The same
  immutable model/preset/reference request returns its completed audio even after
  model deletion. Only work needing inference checks local preparation. **Gap:**
  The parent required replay but did not specify admission order. **Reach:**
  Defaults and chosen origin identities cannot mutate underneath deduplication.
  **Verdict: sound; confidence high.** It preserves saved-byte authority and the
  existing queue identity rather than adding a request-ID database.

## Local model preparation capacity reserve

- **When:** common model preparation19c (`6bc4717a`).
- **Choice:** before copying each pinned model/runtime file, require that file’s
  size plus512 MiB free on the destination filesystem. For example, a2 GiB model
  file is refused with a retryable storage error if only2.2 GiB remains; freeing
  space lets the same explicit preparation run again. Installation uses an
  independent bounded copy, after Node’s clone operation was observed unsupported.
- **Gap:** the plan required truthful capacity and cancellation but did not select
  a free-space reserve. This is a conservative admission policy, not an assertion
  that other processes cannot consume the remaining space.
- **Reach:** local preparation may refuse before the disk is literally full;
  ordinary inspection and synthesis never start an implicit installation.
- **Verdict:** sound, because bounded independent copies preserve source isolation
  and leave some operating space without claiming guaranteed capacity.
- **Confidence:** medium; the reserve is a reversible operational choice and can
  be revisited with measurements on other hosts.

## Empty voice-sampling distributions

- **When:** probability-filter proposal19d1 (`1536a72e`), adopted by the measured
  registered runtime in19d (`ca5a4f39`).
- **Choice:** preserve every already-valid filtering result. If rounding leaves
  no possible next token despite valid input scores, restore the highest-scoring
  token, choosing the first index on a tie. For example, an agent requesting a
  very small positive top-p value gets one available candidate instead of an
  empty probability distribution. The default path stays unchanged.
- **Gap:** the requested full controls did not specify how to repair the pinned
  backend's numerical failure. Raising a guessed minimum would exclude settings
  while leaving the general defect unresolved; replacing the filtering algorithm
  would change outputs that already worked.
- **Reach:** this defines deterministic recovery only for formerly empty results.
  Invalid model scores are not repaired or claimed to be rejected. The policy
  guarantees an available candidate for valid input, not exact ideal probability
  mass from the existing low-precision arithmetic.
- **Verdict:** sound; the recovery has a general nonempty-support property and
  preserves measured valid behavior without changing model precision.
- **Confidence:** medium; this is a narrow compatibility choice. A future change
  to ideal nucleus filtering needs its own identity and output comparison.

## Independent audio extraction operation

- **When:** retained excerpts19e (`b12372b2`).
- **Choice:** expose `audio.extract` separately from `audio.prepare`. For example,
  an agent retaining seven seconds of a processed project receives an ordinary
  audio asset that stays usable after deleting that project. Its historical
  source information describes where the sound came from without keeping the
  donor project alive. Full-output preparation retains its existing purpose.
- **Gap:** the plan required a consolidated preparation seam but did not name the
  public operation or decide whether optional arguments should change its lifetime.
- **Reach:** callers choose durable extraction explicitly; source rendering,
  conversion, jobs and immutable asset publication remain shared owners.
- **Verdict:** sound; the operation name makes the different lifetime visible
  without adding a separate renderer or voice-reference registry.
- **Confidence:** high.

## Explicit voice-reference origin selection

- **When:** public voice generation19f, before implementation acceptance.
- **Choice:** let the agent echo one complete typed origin object returned by
  asset inspection or extraction. Validate that it belongs to the reference
  asset, then freeze that exact selection with the generation request. Omitting
  it selects no historical origin. For example, if the same audio came from two
  projects, adding the second origin later cannot change a saved generation's
  identity or silently switch its attribution.
- **Gap:** the plan required stable explicit origin selection but left its input
  shape unspecified. A separate hash-selector API would add another discovery
  field and lookup surface for metadata the agent already receives.
- **Reach:** the request keeps the selected object; portable generated provenance
  records its derived hash alongside the retained reference asset identity. It
  does not embed a recursively growing tree of generated origins.
  Equivalent selected metadata uses canonical record-key ordering, so adding
  another equivalent stored origin cannot change saved-request identity.
- **Verdict:** sound; explicit structured input uses the existing origin schema
  and preserves stable replay without another reference registry.
- **Confidence:** high.

## Check revision ownership without loading its document

- **When:** cached waveform duration-memory24w.
- **Choice:** dependency lookup and job pinning use the existing live-project and
  pinned-revision availability checks. Only the actual composition consumer loads
  and validates the document and source context.
- **Gap:** the plan required bounded inspection but did not require ownership-only
  consumers to deserialize the entire editing document.
- **Verdict:** sound; shared ownership checks retain missing/foreign/deleted error
  semantics without a new model cache, invalidation policy or public identity.
- **Confidence:** high.

## Start queued execution after service recovery

- **When:** public durable voice jobs19f.
- **Choice:** assembled services explicitly release the shared queue after their
  owners and recovery are ready. Installing dependency admission alone does not
  start execution. Existing standalone initialized queues retain eager execution.
- **Gap:** durable queued work can survive restart before its executor owner has
  been constructed. The plan did not specify an assembly barrier.
- **Reach:** both service entry points use the same barrier. After recording-service
  startup is reported, retryable catalog contention is logged and durable work
  remains eligible for ordinary scheduling; fatal errors remain visible. No new
  polling loop or automatic failed-job retry is introduced.
- **Verdict:** sound; execution readiness belongs to service assembly and the
  existing queue, rather than per-feature retry workarounds.
- **Confidence:** high.

## Preserve voice evidence independently of execution readiness

- **When:** public durable voice jobs19f.
- **Choice:** historical voice receipts use structural validation independent of
  the currently installed execution profile. Exact PCM frames remain authoritative;
  the worker's rounded duration metadata is preserved without changing samples.
  Generated assets retain their reference bytes through existing resource ownership.
- **Gap:** future profile changes must not invalidate old saved evidence, and the
  measured output is not always a whole number of microseconds.
- **Verdict:** sound; historical evidence describes what ran, while current profile
  checks govern new work. Existing fenced publication prevents partial results.
- **Confidence:** high.

## Publish the selected head once when importing history

- **When:** combined document/history scale24u.
- **Choice:** importing history stores each revision while publishing the selected
  current revision once. Ordinary edits and undo still advance the current revision
  within their existing transaction. Request equality, complete history and atomic
  publication remain unchanged.
- **Gap:** the plan required complete history and responsiveness but did not specify
  whether inserting a historical revision should also change the current head.
- **Verdict:** sound; the two operations have different meanings, and separating
  them removes repeated writes without dropping history or weakening replay.
- **Confidence:** high. No new schema, endpoint or configuration is introduced.

## Measured voice execution envelope

- **When:** registered settings19d (`ca5a4f39`).
- **Choice:** expose every measured backend control, while bounding one synthesis
  job by actual decoded reference frames, target tokens, total model input and
  generated code count. For example, a request reaching its output budget without
  the model's end-of-speech signal fails as incomplete instead of publishing a
  cut-off sentence. The agent can choose another explicit request or compose
  multiple generated assets; no hidden splitting or stretching occurs.
- **Gap:** the user required full settings, but the model's configuration limits
  did not establish safe local memory use. The joint measured reference/text/output
  case supports the selected profile; the larger-output memory failure remains
  outside that measured envelope.
- **Reach:** limits and effective clamps are discoverable profile data, independent
  of presets. New measured capacity requires a new immutable execution identity.
  The backend's ignored speed and unverified streaming paths are not advertised
  as working controls.
- **Verdict:** sound; measured bounds and truthful completion preserve control
  without presenting untested capacity as supported.
- **Confidence:** medium; capacity is host/profile specific and may be widened by
  new evidence, while voice quality remains an independent acceptance gate.

## Read the real recording baseline in an isolated selected-recording copy

- **When:** retained-recording preservation23a.
- **Choice:** when the new service cannot open an old-format library, the comparison
  runs the genuine installed service against a backup taken read-only from the
  original library and projected to the
  selected recording's existing rows. Original export intents are excluded so old
  absolute destinations cannot resume; writes are confined to the copied home.
  The original library remains intact. This avoids inventing an old recording's
  history or adding migration code merely to produce a test baseline.
- **Gap:** the plan required matched public old/new behavior but did not choose how
  to access a genuine old catalog after the development format had changed.
- **Reach:** this is a preservation fixture strategy, not a supported migration or
  second production engine. Clock, source selection, explicit cursor processing
  and encoding policies remain their already-recorded contracts.
- **Verdict:** sound; actual source/history provenance survives without resuming
  unrelated work or changing the installed app.
- **Confidence:** high.

## Stop an overflowing camera probe instead of silently dropping its evidence

- **When:** selected-device probe20e.
- **Choice:** if a probe reaches five million timestamp observations, it stops with
  an interrupted result. It preserves the media and observations already accepted
  so the caller can inspect or recover them. It does not quietly stop logging while
  continuing to record and then call that take complete.
- **Gap:** the probe needed a finite bound for a pathological callback stream; the
  plan did not choose a row count.
- **Reach:** this is a measurement-tool limit, not a webcam recording setting or a
  promise about production throughput. The stored mapping is streamed during capture
  and replay, so the bound does not authorize a five-million-record memory array.
- **Verdict:** sound; the explicit interrupted result prevents incomplete evidence
  from being mistaken for a full timing proof.
- **Confidence:** medium; the numerical bound is operational and can be revisited
  for the probe without changing production capture policy.

## Recover a probe’s verified camera content without replacing another output

- **When:** durable camera gaps20e1 and selected-device probe20e.
- **Choice:** a retry identifies the raw media, saved frame mapping and finished
  candidate by their content. If the verified output already exists with the same
  content, retry succeeds; a different output is refused rather than overwritten.
  Copying the probe directory need not preserve the operating system’s file number.
  Raw files, mapping and failed candidates remain caller-owned evidence.
- **Gap:** the probe needed recovery after losing a reply or stopping between
  verification and publication; the plan did not require a new filesystem identity
  schema or an automatic evidence cleanup service.
- **Reach:** existing capture leases, content identities and no-replacement file
  publication remain the owners. This adds no production camera role or cleanup job.
- **Verdict:** sound; retries preserve verified bytes and conflicts cannot destroy
  another file, while retained inputs keep partial outcomes inspectable.
- **Confidence:** high.

## Separate acquired picture ordering from display duration

- **When:** real-capture audit and20e2 correction, integrated in d40f8eb3.
- **Choice being corrected:** the probe treated a callback's reported duration as
  both the next-picture admission boundary and an authoritative outage boundary.
  In the actual take, a picture arrived33.33ms after the previous one, whose
  reported duration was33.34ms. The recorder threw the new picture away for that
  10µs overlap, then represented the manufactured hole as unavailable footage.
- **Gap:** the plan required exact picture identity and no extension beyond camera
  loss, but did not establish that nominal callback duration defines display
  availability. That equivalence was introduced in20e1.
- **Reach:** compare acquired timestamps strictly in order, retain durations as
  evidence, and use verified native presentation support within actual start/end
  boundaries. A displayed previous picture is still that original picture, not
  a newly acquired one. The generic reader already uses this distinction.
- **Verdict:** the old assumption is unsound;20e2 specifies the correction without
  a timing tolerance or fabricated pixels. Preserve the historical failed take
  and its observations; already rejected pictures cannot be recovered.
- **Confidence:** high, supported by exact callback chronology and the existing
  native variable-frame-rate consumer. Physical sync acceptance stays separate.

## Fence saved camera results by their presentation policy

- **When:**20e2 publication/replay integration.
- **Choice:** a durable recovery receipt must explicitly identify native bounded
  presentation. The same raw file and callback log previously produced a movie
  with invented nominal-duration holes. Matching those inputs alone cannot make
  that older output a valid result of the corrected policy.
- **Gap:** existing content identities protected file integrity, but did not say
  which interpretation of camera presentation had been verified.
- **Reach:** older receipts lacking the policy identity refuse without modifying
  any source or canonical output. Newly verified results keep the existing
  identity-based replay and atomic publication. This adds result provenance,
  not a format migration or protocol-negotiation mechanism.
- **Verdict:** sound; preserved bytes cannot be silently promoted into evidence
  for a different presentation contract.
- **Confidence:** high; the real failed candidates demonstrate the distinction.

## Confirm selected word containment in the complete sentence

- **When:**13a remaining speech acceptance packet.
- **Choice:** insert a half-second pause at each authored selection boundary in
  a copy of the complete familiar sentence. The listener can check that each
  pause falls between words while still understanding the sentence. The speed
  candidates use the original boundaries without those added pauses.
- **Gap:** transcript timing proposed the cuts, but did not independently prove
  that protected neighboring words lie wholly outside the changed portion.
- **Reach:** a positive verdict establishes conservative word containment for
  this fixture only. It neither identifies exact phonetic edges nor makes the
  runtime recognize words, widen selections or add pauses.
- **Verdict:** sound; every original sample remains intact, the artificial pauses
  are explicit, and containment is judged separately from naturalness.
- **Confidence:** high; complete familiar sentences follow the user's requested
  listening workflow and avoid unexplained isolated word fragments.

## Measure accumulated camera closure without acquiring another take

- **When:**20e prerecorded stop measurement.
- **Choice:** replay the retained camera movie at its timestamps through the
  existing injected input and real capture writers, then measure stop through
  durable publication. The camera and microphone are never activated.
- **Gap:** offline recovery timing could not establish how long the normal stop
  operation takes, and another physical recording is not authorized.
- **Reach:** this test can demonstrate a slow but successful finalizer. It cannot
  establish live device drain, microphone work or app termination. The result
  does not select a replacement timeout or close those separate gates.
- **Verdict:** sound; the measurement advances the known lifecycle question
  without inventing physical evidence or changing shutdown policy. Empty-edit
  samples are excluded using the existing production timing owner, so the test
  does not introduce its own definition of an acquired picture.
- **Confidence:** high; the remaining limits and original fixture identity are
  explicit, and no further user recording is needed for this scoped evidence.

## Verify background treatments without prescribing an editing style

- **When:** public pause workflow integration.
- **Choice:** a synthetic source has a known ambience-only section and a separate
  harmonic foreground. Explicit edits insert silence, fill it with retained audio,
  or apply selected noise reduction in independent revisions. Matching sample
  rates allow exact preservation checks without borrowing a boundary tolerance.
- **Gap:** the user required flexible tools and practical skill guidance; an
  arbitrary real quiet passage would not establish that the donor lacks speech.
- **Reach:** the test proves composition, scope, mix and undo mechanics. It cannot
  prove natural speech, a preferred noise policy or source separation. Overlaps
  use ordinary separate tracks under the existing track contract.
- **Verdict:** sound; explicit alternatives remain independently usable, with
  listening acceptance kept separate from the signal oracle.
- **Confidence:** high; this directly follows the user's stated product principle.

## Retain full transport evidence only when the journey requests it

- **When:** pause workflow evidence review.
- **Choice:** the shared test harness snapshots requests and raw CLI/MCP replies
  before assertions when the report opts into exchanges. Ordinary callers retain
  compact reports; scale tests do not accumulate every payload unintentionally.
- **Gap:** summary traces could not show exactly what public requests executed.
- **Reach:** reviewers can inspect actual calls, including refusals, without a new
  transport or production logging policy. No public API is added.
- **Verdict:** sound; evidence fidelity improves without changing runtime behavior.
- **Confidence:** high; opt-in recording confines resource costs to the test.

## Preserve the complete stretch call through paged file access

- **When:**14 bounded mono preparation prerequisite.
- **Choice:** give the unchanged stretch engine indexed file pages instead of
  splitting the selected run into processing chunks or mapping complete buffers.
- **Gap:** the accepted recipe required complete-run behavior, but its research
  array adapter did not define a production memory strategy.
- **Reach:** memory used by adapter buffers stays fixed; input can be revisited
  and the output tail can be corrected exactly. Temporary disk usage still grows
  with output, and cancellation checks do not interrupt blocked OS calls or all
  upstream internal loops.
- **Verdict:** sound; this preserves the measured DSP instead of rewriting its
  energy and rounding domains. The signed-int engine domain remains an execution
  representation limit, not a duration policy.
- **Confidence:** high; accepted speech, frozen endpoint hashes and long-run
  equality support the choice.

## Keep preparation publication with the descriptor caller

- **When:**14 bounded mono preparation prerequisite.
- **Choice:** the library accepts an immutable input descriptor and a distinct,
  empty read/write output descriptor. The caller discards output after any failure
  and publishes only after success; the library does not open paths or register
  derivatives. Both array and file entry points use one checked exact recipe.
- **Gap:** the research adapter had no cancellable file contract or production
  scratch ownership, and upstream converted an extreme derived seek unsafely.
- **Reach:** existing prepared-audio owners can adopt this seam without another
  queue or cache. Descriptor lifetime and immutable input are caller obligations;
  unsafe derived seeks return unsupported before invoking upstream conversion.
- **Verdict:** sound; boundary validation protects source identity and separates
  processor success from publication without widening public capabilities.
- **Confidence:** high; explicit ownership fits the existing preparation model
  and failure checks cover partial output, aliases and existing destinations.

## Stretch evidence presentation

The [audited evidence choices](assets/13a-visual-clarity/choices.md) retain exact
recovered PCM and separate diagnostic traces/source guards. They change no
product behavior or listening scope.

## Keep the stereo reference independent of file addressing

- **When:**14c isolated stereo prerequisite.
- **Choice:** compare the interleaved file implementation with the same vendored
  engine using complete planar channel vectors, and pin the complete reference
  outputs. Measure correlated-channel differences as upstream behavior rather
  than introducing a perfect-coherence promise.
- **Gap:** the plan required direct linked-reference parity but did not specify
  how the oracle should avoid sharing the file-layout implementation's mistakes.
- **Reach:** exact equality can expose channel stride/order errors and replacing
  linked processing with independent mono engines. It does not establish new
  perceptual acceptance or improve upstream's measured channel residuals.
- **Verdict:** sound; deliberately different access layouts provide an independent
  execution oracle while preserving the mandated DSP and all mono acceptance.
- **Confidence:** high; the negative independent-mono control distinguishes the
  forbidden alternative without changing the reference or its tolerances.

## Bound scratch readers by active work

- **When:**14d resource correction of14b preparation.
- **Choice:** after writing a prepared run, close its descriptor and keep its
  immutable scratch path. Open a reader only for each bounded block, then close it.
  A300-run sequence otherwise held300 files even while playing only one, exceeding
  the Mac app's default256-descriptor limit.
- **Gap:** the plan fixed request ownership but did not choose descriptor lifetime.
- **Reach:** many-run timelines no longer consume one open file per prepared run.
  Reads pay a file open/close per block; no reader cache or product clip cap is added.
- **Verdict:** sound; the same300-run PCM passes under256 descriptors after the
  recorded old implementation fails.
- **Confidence:** high; the simpler lifetime fits existing bounded block work.


## 14e — Public retiming admission and delivery

- **When:** JS/core/service14e integration.
  **Choice:** Validate native metadata before creating new produced work, then let
  the existing queue transaction own publication of its job and export intent.
  For example, a requested movie pins revision A, waits for the worker to check
  the source's physical audio runs, and still queues revision A if the user edits
  to B while waiting. A rejected run creates neither preview work nor an export
  intent. The alternative would queue known-unsupported work or hold a database
  transaction across a worker wait. **Gap:** The plan specified early validation
  but not how it fits the synchronous queue. **Reach:** Audio, preparation,
  acoustic inspection and preview request/retry APIs now return promises; queue
  submission itself remains synchronous. **Verdict:** sound; the queue keeps one
  transaction owner and rechecks closure/deletion after the await.
  **Confidence:** high.

- **When:** JS/core/service14e integration.
  **Choice:** Preserve exact admitted dependencies during automatic recovery;
  reserve fresh metadata validation for an explicit request or retry. For example,
  a waiting export resumes its previously admitted preview even after cache loss;
  if that job row is absent, the synchronous pump reports a retryable unavailable
  dependency. An explicit retry can validate and recreate it. Existing published
  and retained results stay readable without repeating native source validation.
  **Gap:** The plan did not specify replay behavior after asynchronous admission.
  **Reach:** Recovery cannot secretly launch asynchronous probes from a queue
  callback; callers retain control over recreating absent work.
  **Verdict:** sound; preserves synchronous queue ownership and stored revision
  intent. **Confidence:** high.

- **When:** JS/core/service14e integration.
  **Choice:** Charge a complete retained context once per exact rate when setting
  a worker deadline. Two clips cut from one continuous retimed run share its
  preparation cost. Two almost-equal rates that round to the same sample span
  still need separate conversions and receive separate time budgets. The service
  uses the composition package's existing rational arithmetic rather than a new
  floating-point rate rule. **Gap:** Full-run charging was required but the
  distinctness key was unspecified. **Reach:** Deadline estimates match native
  work identity across state-only clips and split edits; retained PCM reads skip
  preparation cost. **Verdict:** sound; collision and split-control regressions
  prove both sides. **Confidence:** high.


## Exact execution time behind frame labels

- **When:**14f correction discovered by the public14e frame-counter journey.
- **Choice:** keep integer labels for project frame cells, but evaluate content at
  the exact rational frame instant owned by the compiler. Map that exact time into
  source media and use physical presentation membership. For example,30fps frame29
  samples at29/30seconds, even though its integer label is966666us.
- **Gap:** the original rounding rule specified an integer execution instant but
  never measured identity preservation against fractional physical timestamps.
- **Reach:** clip/effect/pointer membership and picture/source receipts must follow
  the same exact instant; frame/movie cache identities change. Audio sampling and
  the accepted stretch recipe stay unchanged. A decoder epsilon or rounding source
  timestamps would hide the defect and corrupt boundary evidence. Native uses
  the existing ExactTime owner to compare requests with physical support; a query
  need not fit CMTime's limited timescale merely to choose an existing picture.
  Reader seeks may start earlier, and integer cursor history uses a floored
  observation cutoff only after the exact source-to-capture mapping.
- **Verdict:** sound correction; the old rule demonstrably selects only80 of120
  pictures in a matching30fps source. Integer frame-cell labels remain derived
  projections of one clock, not an independently adjustable timeline.
- **Confidence:** high in the contract; implementation acceptance requires the
  native counter, fractional membership, pointer and full/range gates in14f.


## Slice16 continuous playback evidence

- **When:** muted playback probe, integrated788030bc.
- **Choice:** observe the frames a muted offscreen player delivers at the current
  host-clock time. For example, a three-second movie must actually advance and
  finish; merely decoding its frames cannot pass. Compare256 interior pixels from
  each delivered frame with the offline frame at exactly the same timestamp.
  This small spatial grid keeps polling cheap; it cannot establish every pixel
  equal, screen presentation, audible quality or perceived smoothness.
- **Gap:** the plan required playback and landmarks without prescribing how to
  observe them without interrupting the person's desktop.
- **Reach:** later checks may reuse this bounded execution probe, but must retain
  separate authoring, full-image and perceptual gates.
- **Verdict:** sound; it observes actual player execution and rejects readiness-only
  and wrong-frame controls without installing or showing a player.
- **Confidence:** high.

- **When:** same playback probe.
- **Choice:** allow three seconds for first output, then require progress within
  the longest decoded frame interval (including the final tail) plus250ms. If the
  player pauses without sending a stall notification, the probe still fails.
  The allowance accounts for the probe being briefly descheduled on this host.
- **Gap:** bounded playback was required, but its test-environment allowances were
  unspecified.
- **Reach:** these are explicit probe limits, not a smoothness standard or a
  production timeout. A future environment must justify changes to them.
- **Verdict:** sound; an actual paused-player control fails the new progress gate.
- **Confidence:** medium; this host-specific allowance is deliberately limited in scope.


## Retimed curves and combined learned delivery

- **When:**16 retimed curve verification, integrated7465290b.
- **Choice:** judge compressed animation timing using the source counter and the
  four edges of an asymmetric landmark, with a two-pixel edge bound fixed before
  rendering. A wrong curve phase moves the landmark beyond that bound. Small
  codec color changes are measured separately rather than treated as a moved
  picture or accepted as strict color fidelity.
- **Gap:** the plan required encoded trajectory conformance without prescribing a
  pixel classifier or raster-edge allowance.
- **Reach:** this fixture's geometry verdict cannot establish text quality, color
  fidelity or perceived smoothness on other material.
- **Verdict:** sound; complete frame coverage and wrong-phase/source controls make
  the timing question discriminating, while color limits remain visible.
- **Confidence:** medium.

- **When:** same curve verification.
- **Choice:** multiply independently calculated gain envelopes by the already
  verified dry retimed PCM. For example, slowing a passage first changes its
  samples; this check then asks whether each one receives the right gain at the
  right clock phase. Reimplementing stretch inside the gain oracle would obscure
  that question and create another version of the algorithm.
- **Gap:** the plan required an independent envelope without fixing its input oracle.
- **Reach:** dry retiming acceptance remains a separate prerequisite; the gain
  check does not silently certify its own source samples.
- **Verdict:** sound; all samples and deliberately wrong envelopes are checked.
- **Confidence:** high.

- **When:**16/15a3c focused public verification.
- **Choice:** add small named cases behind existing harness entry points, retaining
  their established default cohorts. A developer checking a new retimed curve or
  combined effect can run just that case. The obsolete expectation that retiming
  is refused is removed because successful delivery now owns that contract.
- **Gap:** the spec did not prescribe how to extend its verification runners.
- **Reach:** this adds test-maintenance surfaces, no product setting or alternate
  execution path. Shared counter media keeps one dimensions/event owner.
- **Verdict:** sound; each case exercises public operations without re-running
  unrelated accepted cohorts.
- **Confidence:** high.

- **When:**16 evidence integration.
- **Choice:** keep the exact movie files used by the independent playback check,
  even when a later render produces identical decoded pictures with different
  container creation metadata. Record both identities and decoded equality.
- **Gap:** the plan did not specify which duplicate render should be retained.
- **Reach:** playback provenance stays auditable; a new file cannot silently inherit
  another file's playback verdict.
- **Verdict:** sound; preserves the actual observed artifact.
- **Confidence:** high.

- **When:**15a3c post-retime combined verification, integratedcb2dbc57.
- **Choice:** reuse the accepted slowed excerpt and familiar sentence as an
  overlapping technical fixture. First require its dry stem to match retained
  samples, then calculate the mix/gain independently and process that result with
  the frozen C reference. Request a late window before full preparation so a
  completed earlier clip still has to contribute learned history.
- **Gap:** the spec required the combined join but did not choose its fixture.
- **Reach:** the overlap tests execution and state; it is not a new listening task
  and does not extend either original speech-quality verdict.
- **Verdict:** sound; keeps previously accepted media as the upstream authority
  while exposing missing state and ordering.
- **Confidence:** high.

- **When:** same combined verification, after independent review.
- **Choice:** verify movie audio against AAC made from the independent expected
  PCM in a plain unit-rate project, matching each requested range and setting.
  A two-second range is compared with a separately encoded two-second reference,
  because cropping a full AAC file need not produce identical codec tails.
- **Gap:** preview/export equality alone did not show that either contained the
  correct audio, and the spec did not prescribe a lossy-codec oracle.
- **Reach:** the comparison verifies delivery through the existing encoder; it
  does not equate lossy AAC with lossless PCM or establish audible quality.
- **Verdict:** sound; matched full/range decodes agree and wrong-order AAC differs.
- **Confidence:** high.

## Exact admitted media correction (2026-09-30)

Accepted A re-import loses a nonzero last sample because physical admission and
public media authoring narrow exact endpoints to integer microseconds. [03d](slices/03d-exact-media-admission.md)
replaces those field types in place using the existing rational owners and one
shared signed physical origin. Explicit integer floor selections retain their
meaning. Three independent plans were synthesized into authority evidence, signed
carrier, atomic producer/consumer cutover and targeted preservation checkpoints.
The wider atomic cutover avoids temporary rounded adapters between nine otherwise
separable API seams. Default raw-source audio is included; fixing placement alone
would leave the same loss there. No compatibility migration, new clock, whole-file
sentinel, ceil padding or new DSP research is approved. Original red and accepted
quality media remain immutable; the listening audition uses the already verified
original-source retime route and is independent of this defect.

The fresh-format boundary uses the existing catalog and editable-package version
fences, because rounded old integers are indistinguishable from exact new integers
inside an asset. This is sound with high confidence under the no-migration plan:
old runtime/library evidence remains untouched, while new runtime refuses old
metadata rather than silently trusting it. Retained-byte worker independence applies
inside the current format. Normalized acquisition bindings become exact after
mapping from integer capture evidence; capture observations themselves stay integer.

03d projection choices are sound with high confidence: preserve exact mapped
capture events through project projection; keep integer query grids and word labels
as explicit projections. Speech segment rows retain their exact physical range
plus existing integer query columns, so portable receipts do not reconstruct
physical authority from rounded labels. Promote the existing native audio range
owner into Media instead of creating another range/decoder. Preserve signed
capture masks internally while enforcing normalized source domains at inputs.

- **When:**03d native consumer cutover.
- **Choice:** pass the existing source-selection value directly into asynchronous
  audio readers. When a source has a fractional offset, expanding that value into
  separate arguments exposes an installed Swift compiler fault: caller and callee
  disagree about where an array lives. Keeping the source path, stream, offset and
  available ranges together removes the forwarding overload and makes the reader
  consume the same selection its caller already owns. Reordering arguments or
  adding a special box would preserve two competing interfaces.
- **Gap:** the plan did not anticipate a compiler calling-convention failure.
- **Reach:** native readers now have one selection input; no compiler installation,
  build flag or permanent workaround layer is required.
- **Verdict:** sound; the aggregate is the natural existing owner, and standalone
  compiler controls plus actual source decoding distinguish this from data repair.
- **Confidence:** high.

- **When:**03d result-duration and scheduling review.
- **Choice:** derive an extracted or generated audio file's published duration from
  its verified frame count and rate. A6001-frame file at24kHz lasts750125/3µs;
  the voice worker's250042µs label remains an internal observation rather than
  defining the admitted audio. Separately, a job's waiting budget rounds frame
  costs upward to whole milliseconds under the existing cap. That budget controls
  how long to wait, never which samples to select.
- **Gap:** the plan required exact physical authority without naming these two
  downstream uses of a duration number.
- **Reach:** callers may receive a fractional duration while worker labels and
  timers remain integers; consumers must preserve their distinct meanings.
- **Verdict:** sound; verified bytes determine media support and timeouts remain
  conservative scheduling estimates. No model or DSP policy changes.
- **Confidence:** high.

- **When:**03d preservation across the fresh-format boundary.
- **Choice:** reconstruct the frozen follow project through current public edits
  after extracting and authenticating its original media. For example, the old
  package's linked clips are recreated with new IDs, then the whole document is
  compared after normalizing only those IDs. Accepting or relabeling the old
  manifest would bypass the refusal that keeps rounded old metadata out.
- **Gap:** the plan required both format refusal and frozen-output preservation;
  the old fixture previously depended on adopting an old package.
- **Reach:** the fixture preserves editorial meaning and original media without
  introducing a migration path. Its complete dry and processed bytes stay pinned.
- **Verdict:** sound; public reauthoring tests the new format while old artifacts
  retain their historical identity and evidence.
- **Confidence:** high.

## Transcript query measurement and matched movie delivery (2026-09-30)

- **When:** transcript duration-memory harness pass.
- **Choice:** admit real media, then ingest unchanged native word rows while an
  explicit child-process fixture declares model readiness. When a query asks for
  words from this project, normal production storage and projection execute, but
  the synthetic audio was never recognized as speech. The readiness wrapper checks
  model pins and digest; it does not prepare or run a model. A fresh inference run
  would mix recognition cost and variable output into a query-memory comparison.
- **Gap:** the scale plan did not prescribe how to isolate query work without
  repeating expensive inference or installing models.
- **Reach:** these fixtures can establish query values and resource costs, never
  recognition quality or independent audible word boundaries. The readiness seam
  remains inside the existing test child process, with production unchanged.
- **Verdict:** sound; the declared boundary preserves actual admission and query
  behavior while keeping the measurement reproducible.
- **Confidence:** medium.

- **When:** follow-pitch learned movie verification.
- **Choice:** reuse one matched movie-audio comparison for both retiming policies.
  Each preview is compared with a separately encoded plain project containing
  the independent expected PCM at the identical range and encoding settings.
  This extends the already banked matched-codec decision to the follow consumer
  instead of building another oracle with different duration arithmetic.
- **Gap:** the missing follow movie gate left helper ownership unspecified.
- **Reach:** both cohorts share exact physical-duration handling and matched
  decoded-audio assertions; no production processor or output setting changes.
- **Verdict:** sound; one oracle owner prevents the two policies from drifting.
- **Confidence:** high.

## Bounded evidence continuations (2026-09-30)

- **When:**24x query correction.
- **Choice:** retain only the clips a page visits in a lookup that dies with that
  page. When a search resumes at clip1,000, the manifest identifies its ordered
  clips and source dependencies; the existing exact projection owner resolves
  that named clip and any adjacent clip needed for phrase continuity. Rebuilding
  every10,000-clip window per page repeats already settled selection work. A new
  long-lived query cache would retain another owner and invalidation policy.
- **Gap:** the scale plan prescribed bounded inspection without fixing the
  lifetime of projected page data.
- **Reach:** transcript and event mergers share the same named lookup; existing
  immutable revision context remains bounded by its original owner. Query and
  checkpoint formats do not change.
- **Verdict:** sound; reuse canonical exact projection with page-local lifetime.
- **Confidence:** high.

- **When:**24x live dependency review.
- **Choice:** the immutable manifest supplies which unique sources to check, never
  their current status. If a later source changes while an earlier word page is
  being published, fresh checks of every manifest source reject the page. Checking
  only the sources visited on that page would return a continuation already tied
  to stale evidence. Expected generation pins can be hashed once per read, while
  actual source status and project existence are checked both before merging and
  after asynchronous publication.
- **Gap:** avoiding repeated selection discovery could have been misread as
  permission to reuse readiness or generation values.
- **Reach:** immutable revision identity does not eliminate live dependency races
  or deletion; all evidence domains inherit this rule.
- **Verdict:** sound; keeps recovery and refusal behavior while removing repeated
  occurrence deduplication.
- **Confidence:** high.

- **When:**24x public search measurement.
- **Choice:** measure search with the existing authored word cohort and allow
  empty bounded-scan pages to advance by checkpoint. The fixture selects every
  fifth clip containing the literal word“so” to form250 independently expected
  matches. Its100-page harness ceiling catches pathological nonprogress; it does
  not change the product scan limit, cached250ms target or returned-row contract.
  CLI and native-call checks run before the latency assertion so a slow correct
  result retains its full correctness evidence.
- **Gap:** the prior runner measured word reads, whose pages were nonempty, rather
  than sparse phrase matches requiring many more continuations.
- **Reach:** query-family measurements share source/clock oracles while retaining
  their distinct output shapes and page behavior.
- **Verdict:** sound; stronger cursor-value checks preserve the actual continuation
  contract without relaxing the performance gate.
- **Confidence:** high.

## Populated event setup: explicit SDK client capacity (2026-09-30)

- **When:**24y setup diagnosis.
- **Choice:** preserve full edit receipts and configure the sequential verification
  client's existing bounded receive buffer for the legal control-response envelope.
  A10,000-clip edit commits, producing a5.09MB service reply within its8MiB cap.
  MCP sends both JSON text and the structured object; escaping expands their
  combined reply to10.66MB. The SDK's default10MiB receiver then closes, although
  the edit succeeded. This client uses3*the existing service-frame cap+64KiB,
  enough for the structured body, its quoted text and this fixed framing. Raising
  the service cap, dropping normalized changes or discarding one representation
  would change the product contract instead of aligning the test consumer.
- **Gap:** the plan did not distinguish legal service-frame bytes from the larger
  MCP wrapper received by a particular SDK client.
- **Reach:** these sequential control-response checks use a declared bounded
  receiver. They do not promise universal capacity for inline media, concurrent
  replies or external clients retaining the default. The original default-client
  failure remains evidence, and same-request replay must recover the one commit.
- **Verdict:** sound; preserves complete values and the existing service bound
  using a supported client option. Cached latency/RSS budgets remain unchanged.
- **Confidence:** medium; another client may deliberately impose a smaller cap
  and need CLI recovery or an explicitly configured receiver for large replies.

## Populated source-event evidence (2026-09-30)

- **When:**24y fixture integration.
- **Choice:** reuse the actual source-event owners with two pinned input families.
  The tiny authored scene movie supplies a pause and scene at the same instant;
  the unchanged original capture journal supplies cursor coordinates and an
  excluded endpoint. Native normalization runs independently before querying,
  but complete cursor data is also compared with the original journal so two
  copies of a broken normalizer cannot agree unnoticed. Fresh public identities
  and generations fill the independent source/placement clock oracle.
- **Gap:** the scale plan did not prescribe a populated-event fixture, and
  generating a new combined journal would add unverified content.
- **Reach:** the real-fixture branch remains in its existing module, shared with
  every original capture cohort. Query processes permit cleanup only; source
  preparation remains real and distinct from measured cached-query work.
- **Verdict:** sound; tests populated scene/capture and exact retimed cursor
  consumers without a new source-processing implementation or physical claim.
- **Confidence:** high.

- **When:**24y default capture regression.
- **Choice:** include the authored terminal failure message in both completion
  and interruption-row expectations. A synthetic device-loss journal contains
  code and message; current production preserves both. The pre-change fixture
  already failed because its expected object omitted the message. Copying that
  authored message into the oracle checks more payload instead of suppressing
  the extra field or changing native output.
- **Gap:** the old oracle had not followed the earlier diagnostic-preservation
  contract; this pass made the stale check run again.
- **Reach:** every original capture cohort retains full diagnostic assertions
  when using the extracted shared real-source helper.
- **Verdict:** sound; corrects a proven stale expectation and strengthens checks.
- **Confidence:** high.

## Scope of reference-speech acceptance (2026-09-30)

- **When:** listening-gate maintenance after the user's accepted word/phrase auditions.
- **Choice:** close18's fixed reproduction while keeping19's ambience workflow open.
  The user hears the generated word and corrected phrase in their recorded context
  and says they sound good. The same review hears a brief voice sound in the pause
  selected for background ambience. That permits preserving those exact accepted
  replacements, but does not permit treating the pause as clean background for
  future edits. The alternative would either reopen accepted voice work because
  a separate source-region check failed, or mistakenly approve arbitrary looping
  of speech-contaminated room tone.
- **Gap:** the plan did not prescribe how one review spanning accepted contextual
  replacements and a rejected ambience source should resolve the two parent slices.
- **Reach:** later agents inherit the fixed voice runtime/output acceptance and
  leave its media untouched;19 still needs independent clean-region and loop-seam
  evidence. Larger voice/text matrices are future coverage, not invented18 gates.
- **Verdict:** sound; distinguishes acceptance of particular delivered replacements
  from approval of a reusable background source without weakening either contract.
- **Confidence:** high.

## Earlier room-tone candidate (2026-09-30)

- **When:** real pause review after the user heard a voice blip in the old source.
- **Choice:** retain an earlier half-second as a separate candidate, keeping accepted
  replacements intact. The reported blip is about1.05–1.2 seconds into the pause.
  This review takes0.3–0.8 seconds, repeats it with explicit overlapping fades and
  asks the listener whether it contains speech or noticeable seams. The alternative
  would modify the already accepted voice edits or assume that a quiet region is
  clean without hearing it.
- **Gap:** the user's approximate location does not supply a precise clean interval.
- **Reach:** this window is a reversible audition proposal, never automatic ambience
  selection. Its own speech-free and loop verdict must pass before reuse; original
  recordings and accepted replacements keep their identities.
- **Verdict:** sound; makes the rejected source-region gate concretely reviewable
  without claiming unheard quality or changing accepted media.
- **Confidence:** medium.

## Louder ambience monitoring copy (2026-09-30)

- **When:** the user could barely hear the normal-level pause.
- **Choice:** add a labeled+24dB listening copy through the ordinary output gain
  processor. This makes quiet background and any leaked voice easier to notice,
  while preserving a separate normal-level loop. Undo returns the normal loop
  exactly. The alternative would ask the user to judge nearly inaudible audio or
  silently change the gain used in real voice edits.
- **Gap:** the plan specifies no listening-monitor volume for quiet ambience.
- **Reach:** the louder copy is diagnostic only; it does not normalize source audio,
  choose a production room-tone level or replace the accepted contextual outputs.
- **Verdict:** sound; gain is explicit, unclipped and reversible, with both levels
  retained and perceptual acceptance still separate.
- **Confidence:** high.

## Protected-sentence sample alignment (2026-09-30)

**When:** protected-sentence audition packet, 2026-09-30.

**The choice:** Align presentation endpoints to the recording file's sample grid.
For this sentence, the source clock includes the recording's 48,675-microsecond
origin. Starting exactly at 72 seconds therefore lands between two audio samples
after subtracting that origin. Public source extraction rounds down while the
project's sample selection starts at the next sample, producing a one-sample shift.
The packet instead starts 8,675 microseconds later and moves the ending by the same
amount. Both routes then select the exact same samples for the same 2.7-second
sentence, while retaining the ASR-proposed beginning and ending with margins.

**The gap:** The requested complete sentence did not prescribe exact presentation
endpoints or which discrete sample should represent a fractional boundary.

**The reach:** This fixes only the listening packet's selection. It neither changes
production rounding nor supplies independent word boundaries. Future annotations
must retain the actual origin and the appropriate clock instead of copying these
presentation margins as word labels.

**Verdict:** Sound. Exact matched input makes the denoise comparison easier to
assess without silently shifting one reference. No added gain or waveform edit is
needed. The original remains available for the user to assess the proposed crop.

**Confidence:** High.

## Authored stereo container encoding (2026-09-30)

**When:** protected-sentence authored stereo follow-up, 2026-09-30.

**The choice:** Use the existing FFmpeg encoder to wrap explicitly authored
Float32 samples in a WAV file. The sentence's original samples are copied into the
left channel; the right gets exactly half each sample's amplitude. The encoder
receives those already interleaved samples at their original rate and writes
Float32 WAV. A complete sample comparison proves the encoded file retains the
exact declared channels before it reaches the public import and project workflow.

**The gap:** The requested stereo control prescribed channel gains and public
processing, but did not prescribe how to create the source WAV container.

**The reach:** This evidence assembler requires the already installed encoder,
whose binary hash and actual arguments are retained. It adds no production
format writer or dependency installation. Future reproduction can verify the
encoded samples rather than assume an encoder preserves them.

**Verdict:** Sound. Reusing an existing encoder avoids another maintained WAV
writer, while all-frame equality prevents an unnoticed encoding or gain change.

**Confidence:** High.

## Known-noise listening fixture (2026-09-30)

- **When:** known-added-noise complete-sentence packet.
- **Choice:** combine existing steady-noise and transient-noise policies in one
  complete sentence. A listener who hears the original “The sample offer says
  this is free” can compare the same words with explicitly added hum, hiss and
  brief bursts, then RNNoise. The recipe uses the earlier 10 dB aggregate ratio and
  20 ms triangular bursts. Independent channel seeds/phases make the noise stereo
  without turning the mono source into purported real spatial capture. Repeating
  the old tiny unfamiliar excerpts would obscure what words should survive.
- **Gap:** the plan requires steady and transient noise but does not prescribe
  their combined levels or a complete-sentence presentation.
- **Reach:** this is one declared fixture recipe, with no product default or new
  noise engine. The unchanged clean reference remains separately authoritative;
  listening and real stereo quality stay separate from mechanism checks.
- **Verdict:** sound; uses the existing noise ratio and complete familiar words
  while preserving exact duration and original speech before additive noise.
- **Confidence:** high.

- **When:** explicit RMS comparison aid.
- **Choice:** provide a separately labeled gain-only diagnostic matching the
  unchanged clean sentence's RMS, the average signal-energy level. If RNNoise
  reduces the candidate's level, a listener can judge words with that level
  difference compensated while the raw noisy and processed files remain available.
  Matching the noisier whole mixture instead would also compensate for energy
  deliberately added by this fixture. Neither calculation measures perceived
  loudness or justifies an automatic editing policy.
- **Gap:** the plan requires raw and separately matched surfaces without choosing
  the matching anchor for a known-added-noise utterance.
- **Reach:** the saved raw public output remains untouched. The extra copy uses
  only explicit offline Float32 gain; future edits do not inherit normalization.
- **Verdict:** sound; controls a declared comparison variable while retaining
  raw gain and clipping evidence and reporting the copy's provenance.
- **Confidence:** high.

## Camera publication buffer hashing (2026-09-30)


**When:** offline camera publication performance pass, 2026-09-30.

**The choice:** Hash the existing locked pixel memory directly in the same private
picture-digest owner. When the publisher verifies a frame, it already holds the
pixel buffer's read-only lock. CryptoKit consumes a buffer view synchronously,
so each view finishes before unlocking. Rows whose physical stride equals their
visible width can be passed together; otherwise only the visible bytes of each
row enter the digest. The timestamp and dimension prefix stays identical. The
alternative would keep creating and copying a new Data object for every row.

**The gap:** The preservation contract fixed the digest's contents but left the
memory representation and hashing call granularity to implementation.

**The reach:** Camera raw/canonical verification keeps the same digest and
recovery authority while avoiding millions of temporary row copies. The code
continues to depend on the publisher's existing forced BGRA decoder format; this
adds no planar-image support or lifetime-spanning pointer cache.

**Verdict:** Sound. Complete retained-picture parity and contiguous/padded
publication tests preserve the byte stream, and stage timing identifies hashing
as the relevant measured cost. The change does not adjust the shutdown deadline.

**Confidence:** High.

### Publication fixtures

**When:** the same pass's preservation checks.

**The choice:** Exercise contiguous and padded decoded memory through actual
publication, using two tiny encoded fixtures. A lossless BGRA movie makes the
contiguous case precise; an ordinary camera codec, H264, supplies realistic padded
rows. Independently serialized decoded pixels define the expected full picture
digests. The alternative would expose the private hashing function for tests or
create another maintained digest implementation.

**The gap:** The contract required preservation but did not prescribe a test seam
for memory layout and padding.

**The reach:** Default offline capture checks now protect timestamp/dimension
serialization, visible pixels and padding exclusion at the public publication
boundary. The fixtures and expected output are tied to the current native BGRA
decoder contract; changing that contract requires examining their provenance.

**Verdict:** Sound. The tests exercise the production owner and fail when padding
is included without adding a production test hook or parallel digest abstraction.

**Confidence:** High.

### Offline canonical-date comparison

- **When:** camera publication preservation review.
- **Choice:** Compare complete exported movie files after excluding only their
  six documented creation/modification date fields. Exporting the same pictures
  twice writes different wall-clock dates into the MOV container. The review keeps
  each actual file hash and the original strict-equality failure, identifies the
  date fields from their container boxes, and then compares every remaining byte.
  This changes only the offline comparison. Production still checks exact acquired
  timestamps, dimensions and every decoded picture before publishing.
- **Gap:** The plan requires preserved media but does not prescribe how an offline
  whole-file comparison treats AVFoundation's fresh export dates.
- **Reach:** Future reproduction must distinguish export wall-clock dates from
  media timing. It may not mask presentation times, duration, sample bytes or
  arbitrary metadata; the original identities remain inspectable.
- **Verdict:** sound; the exception names the six exact date fields, retains the
  strict red and independently verifies the complete remainder without weakening
  production decoded-picture checks.
- **Confidence:** medium.

## Finite denoise acceptance reconciliation (2026-09-30)

- **When:** final12c/15a3/15a evidence reconciliation.
- **Choice:** Close the named local denoise matrix when the exact meaningful
  sentence, post-retime, authored stereo and known-noise hearing cases pass,
  alongside the retained execution proofs. A listener now accepts the complete
  words and channel balance; public/native checks separately prove duration,
  selection, state, order, history and delivery. Independent word-boundary marks
  needed for accurate cuts and speech-free ambience needed for looping keep their
  own gates. The alternative would ask for extra speakers or naturally recorded
  stereo without an explicit requirement, or pretend these verdicts supply cut
  labels and loop approval.
- **Gap:** The plan named the quality cases without prescribing how to reconcile
  later complete-sentence verdicts with historical cropped-packet pending states.
- **Reach:** Later passes inherit the frozen accepted implementation and exact
  media verdicts, without repeating hearing or transferring approval to arbitrary
  inputs.12/12d and19 remain independently accountable for their missing evidence.
- **Verdict:** sound; it satisfies the finite named denoise requirements without
  weakening independent cut accuracy, ambience or installed acceptance.
- **Confidence:** high.

- **When:** executable reproduction pointers in the same reconciliation.
- **Choice:** Point planned denoise probes at the existing frame/native/public
  runners that already perform the required work. An agent following the plan
  reaches executable owners and pinned receipts rather than a nonexistent proposed
  filename. A forwarding file would add another maintained entry point while
  repeating the same operation.
- **Gap:** Planned names preceded the implemented harness organization; no public
  consumer depends on those speculative filenames.
- **Reach:** Future reproduction uses the actual contract owners and their evidence;
  this creates no compatibility shim, duplicate engine or new API.
- **Verdict:** sound; preserves runnable verification while deleting stale planning
  instructions.
- **Confidence:** high.

One documentation discretion: the acceptance ledger is the canonical index;
historical experiments retain their scoped limitations and refer to later verdicts.

## Room-tone overlap refinement (2026-09-30)


**Content-clock keys, one source occurrence per track.**

- When: revised room-tone overlap packet.
- Choice: Each repeated region starts at source time zero on its own audio track.
  A content-anchored gain window means the curve follows that region's local source
  samples. For example, while one region plays its last200ms, the next plays its
  first200ms; both contribute through the existing public mixer. The keys are
  read back from public processing state before the independent sample calculation.
- Gap: The request fixed the fade shape but did not prescribe track layout or key
  anchoring. Alternating a smaller set of tracks would also represent this fixed
  loop, but would add placement/track-assignment logic to a single finite packet.
- Reach: This declares only the review project's layout. It adds no product
  ambience helper, automatic region choice or default processing policy.
- Verdict: sound. Explicit public occurrences and content windows make the two
  simultaneously playing source positions unambiguous without another renderer.
- Confidence: high.

**Keep complete transient deliveries in the exchanges instead of duplicate WAVs.**

- When: revised room-tone overlap packet.
- Choice: The scratch run writes and checks the actual dry-source and undo WAVs.
  The durable packet retains the original source in its existing home and one
  normal loop. The dry source is byte-identical to that original; undo is
  byte-identical to the normal loop. Their complete MCP audio bodies, public
  receipts and hashes remain in the compressed exchange record. A reviewer can
  reconstruct either transient delivery without a second copy of those samples.
- Gap: Actual undo delivery was required, but redundant permanent audio files
  were not. Retaining all four WAVs would duplicate bytes already preserved.
- Reach: The report's delivery entries describe actual runtime deliveries,
  including transient ones; they are not a permanent filename inventory.
- Verdict: sound. Complete transport evidence preserves the equality proof and
  avoids unnecessary repeated audio assets.
- Confidence: high.

### Full-half overlap comparison

- **When:** response to the user's qualified improvement and request for low-hanging
  refinements.
- **Choice:** Try250ms overlaps on the same half-second source, rather than add
  new audio or change its speed. The200ms case has100ms in each interior cycle
  where only one occurrence plays; the250ms case blends two throughout the
  interior. A listener can compare that one treatment change at the same explicit
  output gain. The curve midpoint shared by its incoming/outgoing envelopes is
  represented once, avoiding duplicate authored times.
- **Gap:** The user asked for another small improvement without prescribing its
  fade duration. The existing public gain/mixing owners support this finite case.
- **Reach:** This is an explicit review-project recipe, not automatic room-tone
  selection, normalization or a new processing default. The prior candidate and
  its qualified verdict remain available if this treatment sounds worse.
- **Verdict:** sound; preserves the accepted source while testing whether continuous
  overlap improves its remaining audible seam. Hearing decides between treatments.
- **Confidence:** medium.

Both recipes remain frozen as execution evidence. Their authored parameters differ,
while production execution remains owned by the existing public mixer and scalar
curves; no parallel production renderer is introduced.

The final user choice retains the200ms treatment and explicitly tolerates its
small residual seam. The250ms trial is rejected for a perceived whirling sound;
it remains negative evidence, with no production adoption or further tuning.

### Sentence marking starts with four bounded targets — sound, medium confidence

When: 12d marking page, 2026-09-30. The user requested a simple page to provide
independent audible boundaries. It presents the sentence edges and the three
words surrounding the cut: paragraph, uh and this. All times start blank. If two
connected words have no clear edge, the listener leaves it unknown instead of
being forced to fill every proposed word. The request left the marking surface
unspecified. This bounded starting point resolves the immediate cut evidence;
it cannot claim the broader speech corpus has been annotated. Future corpus
work must collect its own actual labels. Sound because it keeps the requested
human task small without inventing exact boundaries.

### Save separate annotation snapshots — sound, high confidence

When: 12d marking page, 2026-09-30. Pressing Save writes a uniquely named local
JSON file in the output directory given to the local server; another Save creates
another file. Existing source audio and frozen annotation proposals remain
unchanged. The request did not choose persistence. Separate snapshots let the
agent inspect what the listener submitted before deliberately reconciling any
ranges into canonical evidence. There is no automatic import, autosave or reload
of previous drafts. Sound because no submission can silently overwrite existing
truth, and the finite page needs no new product storage owner.

### Bind exports to one source clock and preserve unknown authority — sound, high confidence

When: 12d marking page, 2026-09-30. A time of one second in the clip becomes one
second after this clip's already source-clock start; its recording offset is not
added twice. Browser readouts and server exports share that conversion. The server
checks audio/source/annotation hashes and exact source interval before saving,
so an old page cannot attach marks to changed audio. The request did not choose
an export schema. Drafts contain no independent labels; confirmed partial edges
still cannot form a full range, and any confirmed filler inventory explicitly
remains incomplete for the corpus. Sound because a saved mark retains both its
source identity and the limits of what the listener actually supplied.

### Next confirms the selected boundary — sound, high confidence

When: initial marking page and the user's interactive-flow correction, 2026-09-30.
The listener clicks a point and hears a preview. Next confirms that selected
point, even though the playback cursor has moved. Each confirmed point stays in
memory as the page advances; Back can revise it and Skip leaves an edge unknown.
The user explicitly requested Next as the confirmation action, replacing the
checkbox. The request did not choose when to write the accumulated record.
The last Next saves one separate snapshot, so intermediate corrections do not
create many competing records. During saving, editing is disabled; a failure
keeps every selection and Next retries, including when the last edge was skipped.
Closing or reloading before completion still loses the in-memory work, as in the
original page; no autosave or persistence owner was introduced. Sound because
confirmation applies to the selected point and missing edges stay unknown.

### Diagnostic movie evidence retains exact date patches — sound, high confidence

When: camera digest cost audit, 2026-09-30. Two temporary canonical movies were
verified byte for byte against an already retained base. Only six container date
fields differed. The audit stores those exact date bytes and both observed full
file hashes; replacing those fields in the retained base reproduces each hash
exactly. The temporary copies were then removed, freeing test scratch space.
The plan did not choose storage for this new diagnostic evidence. This preserves
the actual observed files without keeping duplicate large movies on the nearly
full disk. Future verification must use the pinned base and recorded patches;
no image, time, codec or production publication policy is changed. Sound because
full equality and reconstruction were proven before cleanup.

### Keep the complete clip in the browser while marking — sound, high confidence

When: marking-page repair, 2026-09-30. The listener opened a page whose server
had stopped and saw a player with zero seconds. The restored server runs outside
the launching command session. Once the page loads, it holds the entire small
original recording in browser memory before enabling marks. If the server then
stops, replay and seeking still use those same original bytes; saving reports a
failure and keeps the inputs. Reloading still requires the server. The request
left server lifetime and media loading unspecified. Streaming alone would keep
later seeks dependent on that process, while installing a permanent service
would add unnecessary product machinery. This bounded evaluation clip costs
about 1.4 MB in browser memory and adds no new dependency or media transform.
Sound because it repairs the actual failure with platform process separation and
complete local media, without promising permanent hosting or changing evidence.

### Keep waveform selection and confirmation together — sound, high confidence

When: marking repair and the user's interactive-flow correction, 2026-09-30.
The listener sees one prompt, its waveform, the selected blue line and Next in
one compact panel. A click chooses the boundary; Next confirms it without
scrolling to a separate input row. The opening “um” comes first because the user
reported it. The server's target list owns that order and identifies filler
ranges for export, while original recording details remain collapsed. This
supersedes the earlier sticky player above a long form, which still forced the
user to move between separate controls. The request chose the two-action flow
but left exact layout unspecified. This affects the bounded evaluation page
only and supplies no suggested boundary times. Sound because the listening task
now follows the user's requested actions and preserves human boundary authority.

### Preview from the clicked point without moving the selection — sound, high confidence

When: guided waveform page, 2026-09-30. Clicking selects a blue boundary line and
plays a short excerpt starting exactly at that point and ending shortly after it.
The orange playback cursor moves while the selected point remains fixed. A
second click cancels the earlier preview; an old cancelled playback request
cannot clear the new preview's stop point. The user requested waveform clicks
and Next, then explicitly chose playback from the click instead of a lead-in.
Starting a preview on the click lets the user audition that boundary without an additional Play action. Loading and
Next start no sound; tests mute previews in a separate tab. The current short
window is a reversible listening aid, not a proposed boundary or acceptance
threshold. Sound because playback now follows the user's explicit preference;
the point confirmed by Next remains unchanged.

### Apply the native join envelope after narration clips combine — sound, medium confidence

When: exact human-marked filler reproduction, 2026-09-30. Removing the two
marked fillers leaves two neighboring narration clips. Fading each clip before
mixing produced the correct amplitudes, but adding sibling silence changed one
negative zero to positive zero. These sound identical yet have different stored
bits, so the strict reference comparison correctly failed. The named fixture
now applies the same fade to the combined narration track. The public track
clock accepts whole microseconds; held keys specify each native sample's gain
until the next key. Expanding the two short ramps into 482 keys reproduces the
complete native envelope, including its signed zero, without a compensating
operation aimed at that one sample. The older accepted fixture keeps its proven
clip recipe. The plan required exact bytes but left public envelope authoring
unspecified. This is bounded fixture authoring data through the existing gain
API, not a new production processor or general cleanup policy. Future fixtures
must prove their full output rather than inherit this recipe. Sound because it
preserves the entire reference and existing mixer semantics; confidence is
medium because the exact sampled authoring is less compact than a linear curve.

### Bind a relocated reference packet by its bytes — sound, high confidence

When: exact human-marked filler reproduction, 2026-09-30. A native packet prepared
in scratch must move into durable evidence without changing the edit it defines.
The existing public journey accepts an explicit reference directory and records
the report's hash. Reinspection permits a different directory only when those
report bytes match; actual WAV hashes remain checked. Its default still uses the
frozen accepted packet and original pins. The plan left the second fixed packet's
storage unspecified. Binding the original scratch path would prevent honest
archival, while silently substituting another report would weaken evidence.
This adds one harness selector and no product API or schema. Sound because
location can change while the actual reference identity remains fixed.

### Give the changed two-filler candidate its own acceptance record — sound, high confidence

When: saved human-mark reconciliation and exact cleanup, 2026-09-30. The saved
labels expose a prefix of the middle filler left by the older accepted cut and
also mark the opening filler. A separate candidate removes exactly those two
ranges; it preserves the older files and listening verdict. Its technical
evidence proves exclusion and retained samples, but its listening record stays
pending until feedback on these changed bytes. The plan did not specify how a
new labeled candidate should coexist with an accepted inherited cut. Replacing
the old bytes or borrowing their approval would erase a useful comparison.
This supplies one named-target fixture and leaves automatic discovery, complete
technical inventory/timing with their existing gates. Editorial repetition intent
belongs to the external caller, not a product gate. Sound because each
claim remains tied to the recording and judgment that actually support it.

### Count changed float encodings when reporting exact PCM — sound, high confidence

When: exact human-marked filler reproduction, 2026-09-30. The byte comparison
rejected a zero whose sign changed, but amplitude subtraction reported zero
changed samples. The report now counts different 32-bit float encodings while
retaining amplitude measurements separately. A single-channel zero-sign
mutation therefore reports one changed sample and still fails. The plan left
diagnostic counting unspecified; numerical counting alone concealed the cause
of an honest failure. This affects harness reports only and changes no equality
gate. Sound because diagnostics now describe the same exact contract they judge.

### Reuse the marking page for one disputed word in original context — sound, medium confidence

When: workbench-boundary preparation, 2026-09-30. The speech engines disagree
about the last sound in “workbench”, and the older visual mark cannot resolve
which sound belongs to that word. The same waveform page now accepts an explicit
packet whose sole target is that word. The original opening context includes
the proposed first two sentences; two clicks confirmed with Next can mark the
word without typing times. No estimated edge is prefilled. The plan required an
independent endpoint diagnosis but left the presentation unspecified. A word
fragment would remove the context the user previously needed, while another
annotation UI would duplicate the already requested workflow. This adds one
evaluation-harness packet selector and preserves its default sentence packet.
It does not select a speech engine or imply broader inventory completeness.
Sound because it prepares the actual missing listening evidence without changing
the recording; confidence is medium because the context length is a reversible
presentation choice and the proposed transcript still needs listening verification.

### Export the word targets the listener actually marked — sound, high confidence

When: workbench-boundary preparation, 2026-09-30. A workbench-only page must not
export empty entries for “paragraph” and “this” from the previous sentence. The
existing annotation owner now derives its protected-word entries from the page's
non-filler word targets; sentence and filler targets retain their separate roles.
For the original page this produces the same two entries, and for the new page
it produces only “workbench”. Skipped edges remain unknown. The plan left the
second packet's export unspecified. Hardcoding the earlier words would make the
saved evidence misdescribe the task, while a second export owner would drift.
Future packets must explicitly name the words they ask the listener to mark;
this does not infer removal intent or discover missing words. Sound because
the target list already owns identity and the export now follows that owner.

### Retired personal repetition-intent solicitation — scope error corrected

When: repetition-intent preparation and user correction, 2026-09-30. The proposed
transcript said “Return to it” twice. Preparing unchanged surrounding audio
proved source delivery, but asking the recording owner whether the later phrase
was deliberate and making the answer block implementation was an unsound scope
choice. The user clarified: zero editorial decisions, only primitives; the agent
using the project makes those decisions. The solicitation is retired and its
unanswered record remains historical. Future development measures evidence and
executes fixture-specified edits; it does not undertake a personal editorial
task. The audio proof remains valid and no keep/remove answer is inferred. This
corrects the earlier sound verdict without inventing new acceptance evidence.

### Rescore retained outputs while disclosing missing preparation — sound, medium confidence

When: actual-human-edge comparison, 2026-09-30. The listener has marked words,
and the saved alignment results still exist, but their prepared 16 kHz audio
file has disappeared from scratch. The comparison checks the retained results
and recorded identities, then scores the same eight marked edges for every
condition through the existing evaluator. The missing opening filler is
reported separately and cannot earn a complete-cleanup pass. The plan did not
specify whether absent preparation prevents this limited inspection. Refusing
all comparison would discard usable saved predictions; certifying a fresh run
would claim evidence that no longer exists. The result therefore describes only
the retained predictions on this small cohort, with no current runtime proof or
recipe selection. Sound because its claim stays within the evidence that can be
checked. Confidence is medium because broader acceptance still needs complete
labels and its own preserved execution evidence.

### Complete the fixed packet independently of aggregate quality — sound, high confidence

When: scoped 12d completion audit, 2026-09-30. The sentence packet already has its
source binding, explicit-cut media/undo proof, actual marked neighbors and its
own accepted join. Its last open checkbox instead asks for the entire corpus
speech-quality pass. That belongs to parent12, so 12d now records completion of
its fixed packet while 12 stays open. The plan conflated an evidence packet's
completion with selecting a production speech recipe. Keeping them coupled
would hide completed primitives without supplying missing aggregate evidence.
Future adoption still needs 12's technical quality and 12b's public parity. Sound
because retained artifacts and independent reviews prove every requirement within 12d;
the 15 ms filler prefix, existing scores and broader failures remain unchanged.

### Preserve the selected baseline while checking public parity — sound, high confidence

When: feedback-driven spec review, 2026-09-30. The earlier recording contract
already selected Parakeet with best-effort fillers and disclosed timing misses.
The new plan nevertheless required a better model to win before its public
integration could proceed. The revised12b pass compares the current pipeline's
requests, raw results, generations and explicit edit outputs through existing
owners. Broader quality measurements stay open; a changed model still needs its
own evidence. The planning gap was confusing preservation of an accepted behavior
with accepting a replacement. This enables useful primitive verification without
claiming that omitted speech or inaccurate acoustic boundaries were repaired.

### Separate preparation from final release acceptance — sound, high confidence

When: the same spec review. Missing physical camera proof previously serialized
unrelated speech, camera API and consumer work. Isolated wiring and matched
preservation now proceed from verified source/clock/lifecycle owners. Final
physical acceptance, installed switching and owner removal still require their
actual evidence and authorization. The plan did not distinguish those dependency
kinds. The correction removes artificial waiting without inventing a physical
pass, a second production engine or a compatibility layer.

### Test an external caller with a bounded fixture brief — sound, high confidence

When: the same spec review. The final workflow wording could make a development
agent start editing the user's personal tutorial. The test instead gives an
external caller a declared fixture request and protected content, then checks
discovery, explicit effects, delivery, replay/undo, export and truthful limits.
The caller chooses how to use the primitives within that brief; the engine makes
no editorial choice, and reviewers do not grade one preferred style. The plan
left the test brief unspecified. This preserves the integration scenario set
while keeping development and consumption of the toolkit distinct.

### Shared-library storage categories — sound, medium confidence

When: 23c (2026-09-30).

- **Choice:** Count retained project-library files as shared bytes. When two
  projects use one asset, the aggregate counts its actual file length once. It
  does not estimate each project's share. Registered temporary derivatives remain
  cache bytes, and private external export staging remains other bytes.
- **Gap:** The plan required truthful storage preservation without assigning new
  project-specific ownership categories to files shared by several projects.
- **Reach:** The existing public aggregate shape stays usable through cutover;
  scoped project accounting would require its own requested contract.
- **Verdict:** Sound. One real byte observation avoids an invented allocation
  policy and preserves the existing category meanings for recording consumers.
- **Confidence:** Medium.

### Explicit camera facts across owned peers — sound, high confidence

When: 21a (2026-09-30). A device/status response now supplies a camera list and
camera permission state explicitly. An empty list and an unknown state are
valid facts; a missing field is an invalid peer response, rather than something
the service interprets as no camera or a permission denial. The plan did not
specify omission handling for these new fields. This keeps every owned producer
and consumer on the same truthful contract without a fallback or compatibility
layer; future camera selection still requires its own working lifecycle.

### Isolated scratch for the controller gate — sound, high confidence

When: 21a. The existing scripted controller gate can compile into a caller-selected
scratch directory. Its ordinary default and scenario set remain unchanged.
The plan required preserving the native gate and frozen workers but did not give
this runner an isolated output option. A test-only scratch location lets the
same gate run against changed source without overwriting a frozen build. It adds
no product setting or installed-application behavior.

### Camera implementation seams before public exposure — sound, medium confidence

When: remaining21 reslice (2026-10-01). The plan now separates closed camera
publication, input acquisition, durable source adoption, project construction and
public selection. Three independent drafts agreed on the result/retry defect; one
preferred three broader passes. Five small seams make each ownership boundary
verifiable and allow input/adoption work in parallel. Public selection waits for
its complete execution path, so an accepted selector cannot be silently ignored.
This chooses implementation order; it does not authorize a presenter layout or
change physical acceptance.

### Attempt independent publications before reporting an operational failure — sound, medium confidence

When: 21b (2026-10-01).

- **Choice:** A camera's filesystem publication failure still lets primary audio
  attempt its existing publication. For example, a read-only camera directory
  blocks its canonical file while the narration is ready. Narration can become
  verified and playable during that stop attempt. NativeCapture then reports the
  camera error and keeps both journal leases, which are the exclusive authority
  to finish the take. Explicit retry verifies completed sources and attempts the
  unfinished one. The alternative would repeatedly stop at camera's first error,
  preventing independent audio from making progress.
- **Gap:** The plan required shared retry ownership but did not specify the order
  or progress behavior when independent source publications encounter errors.
- **Reach:** Later source adoption inherits one complete take outcome without
  losing independently verified media or adding a second finalization owner.
- **Verdict:** Sound. It extends the existing audio publisher's per-role progress
  rule to the independent camera source and retains the first operational error.
- **Confidence:** Medium.

### Honor publication cancellation after physical closure — sound, high confidence

When: 21b.

- **Choice:** If cancellation arrives while input drain is held, the owned stop
  still finishes the camera encoder and records its immutable byte identities
  before honoring cancellation at publication. NativeCapture awaits this closure
  step inside the existing termination operation. The alternative could cancel
  the byte scan after encoder finish and lose the closed source while a caller
  believes retry is safe. No device or encoder is reopened by retry.
- **Gap:** The plan distinguished closure from publication but left the native
  task-cancellation boundary to implementation.
- **Reach:** Future selected inputs can reuse this lifecycle without implementing
  their own cancellation teardown. Transport callers still do not cancel shared
  work, and physical completed-stop acceptance retains its existing limit.
- **Verdict:** Sound. Cancellation ends an attempt to publish, while already
  owned physical closure must finish and remain reviewable.
- **Confidence:** High.

### Keep media conflicts terminal while another source retries — sound, high confidence

When: 21b.

- **Choice:** Suppose another file occupies the camera's canonical name, and
  primary audio also encounters an operational error. The camera returns a
  terminal conflict: it has no verified canonical source to offer. Removing the
  conflicting name before audio retry does not turn that same closed camera
  outcome into success. Successful camera publications are instead reverified
  against their complete input, receipt and canonical byte identities on each
  retry. The alternative would either silently promote a terminal source or
  trust an old success after its media had changed.
- **Gap:** The plan required truthful terminal outcomes and retry but did not
  specify how a settled companion interacts with a still-unfinished primary.
- **Reach:** Source adoption can distinguish stable unavailability from an
  operational retry without inventing represented pictures or replacing files.
- **Verdict:** Sound. Terminal failure is retained; success keeps its verification
  obligations until the take settles.
- **Confidence:** High.

### Do not repeat an uncertain terminal journal append — sound, high confidence

When: 21b.

- **Choice:** A finished journal row may reach disk before synchronization fails.
  That failure is reported as bounded journal failure, and the append attempt is
  remembered. A later primary retry can verify camera media and retry a result-file
  write, but cannot append a second finished row. A camera journal error also
  cannot skip physical encoder finish. The alternative would use metadata retry
  as permission either to duplicate completion evidence or to abandon the encoder.
- **Gap:** The plan required terminal ordering but did not classify the point
  where a failed append may already have changed the journal.
- **Reach:** The existing acquisition journal remains the single lifecycle
  history; recovery sees actual completion or incomplete evidence rather than a
  fabricated repaired history.
- **Verdict:** Sound. It follows the existing writer's terminal journal-failure
  behavior and preserves raw closure independently of metadata availability.
- **Confidence:** High.

### Keep captured-source facts separate from composition choices — sound, high confidence

When: spec reconciliation after the user's zero-editorial feedback (2026-10-01).
The earlier plan promised automatic linked-project construction at capture finish,
but did not specify which visual source went first or which picture covered the
other. Those are presentation choices. Capture now publishes independent assets
and exact common-clock mappings; the external caller creates the project and
submits explicit placements/links through existing commands. The existing stores
allocate IDs and preserve request replay. Documented single-AV defaults keep their
scope. This changes automatic capture-finalization project construction into
explicit caller construction, while preserving recording-to-project capability,
independent edits and synchronized portable delivery. No new authoring API or
capture-start setting is added. The correction follows the user's requirement
that the toolkit make zero editorial decisions; it removes unspecified policy
instead of selecting a layout on their behalf.

### Inspect host contention before timing — corrected, high confidence

When: 24z source-cardinality diagnostic (2026-10-01). Coordinating this project's
lanes alone was an unsound basis for treating the host as quiet: other applications
and builds can consume the same CPU. Future timing inspects whole-host contention
before launch and states any remaining limits. The existing contended cohort stays
retained; this correction authorizes neither a replacement run nor a higher budget.

### Keep source-cardinality controls and timer scope explicit — sound, high confidence

When: 24z. Both arms use the same populated catalog and 1,024 clips, including
identical leading empty clips. Only referenced source-selection cardinality
changes. Those empty clips exercise actual continuation progress instead of
assuming each page returns rows. The warm timer covers complete delivery through
the unconfigured SDK; oracle comparisons, telemetry and file writes follow it.
Resident memory in the shared process remains descriptive, without treating the
two arms as separate processes or borrowing the duration-memory ratio rule.
These are diagnostic choices, not production caching or response-policy changes.
## One public speech parity journey for frozen and actual inference (2026-10-01)

- **When:** bounded12b actual selected-source parity extension.
- **The choice:** Keep one public journey and one fixture service for both inference modes. When a caller supplies an existing model directory, the same admission, transcript, explicit cut, protected media, restart and generation operations run with real native speech replies. Without that option, the established frozen-response journey remains available. A separate actual-only script would copy the public checks and let their contracts drift independently. The readiness declaration stays a fixture input in both modes, rather than becoming a new production model API.
- **The gap:** The plan required actual inference through the public owners but did not prescribe whether to extend the existing journey or duplicate it.
- **The reach:** Future parity changes update the public-operation sequence once. The fixture's readiness declaration cannot be cited as production preparation-owner readiness, even when its native inference is real.
- **Verdict:** sound; one operation sequence preserves matched inputs and makes the inference boundary explicit.
- **Confidence:** high.

### Keep bounded attempt evidence in the existing request record

- **When:** root review of the same pass.
- **The choice:** Reserve a speech attempt in the existing request record before calling native, save its exact request before launch, and save its reply or error afterward. A failed launch or a bad returned file still consumes its attempt. Writes to that small record execute in order, so two callbacks cannot overwrite each other's evidence. A success-only counter would hide failed work and allow more native attempts than the fixture authorized; a separate general-purpose tracing store would add another owner for this bounded experiment.
- **The gap:** The request bound did not prescribe durable failure accounting or the record format.
- **The reach:** A restarted fixture sees the same consumed attempts. Missing or refused raw output remains visible as a failure rather than becoming an implicit retry.
- **Verdict:** sound; the record binds work performed to the existing explicit bound without adding production tracing hooks.
- **Confidence:** high.

## Make the external-caller request concrete with a short fixture (2026-10-01)

- **When:** preparation of the 25 fixture brief, before its execution prerequisites.
- **The choice:** Give the external test agent one short scratch project with named saved checkpoints covering every required primitive. Its request supplies exact marked cuts, an accepted retiming selection, a two-second camera/screen/microphone interlude, a processed pure split, voice treatment, pause and delivery. The fixture uses 1280×720 at 30 fps, balanced encoding with a 3 Mbps average-video override, a 600 ms pause and an explicit music gain curve. These values make the expected effects inspectable; they are not product defaults or a preferred editing style. The external caller still chooses operations, reversible layout and the zoom landmark.
- **The gap:** Slice 25 required a bounded user brief but supplied neither an executable media request nor concrete output and placement parameters.
- **The reach:** The future grader checks requested effects and protected media rather than judging taste or asking the person to identify more removals. The four-minute take remains the camera authority; its short use here cannot satisfy the independent physical gate. Preparation does not replace the installed journey or authorize a new model/capture operation.
- **Verdict:** sound; a complete technical fixture can exercise caller-controlled composition without putting editorial judgment in the engine or editing the person's tutorial as development work.
- **Confidence:** high. Reversible presentation discretion was already delegated by 25; no new product policy is chosen.

### Fence startup cleanup within the existing take owner — sound, high confidence

When: 21c (2026-10-01).

- **Choice:** Suppose a screen lookup or camera start reply arrives after its take
  was discarded and another take began. The existing generation identifier tells
  which take still owns the work. Discard ends selection even before a writer
  exists. Preparation checks that identifier after lookup and before opening the
  selected camera, then NativeCapture checks again before writing shared state.
  An obsolete returned input is released locally; a writer-construction refusal
  also releases only its prepared resources. Neither cleanup can clear the newer
  take. Failed active startup instead joins the existing termination operation,
  which clears its size/state and ends its generation inside the owned task.
- **Gap:** The plan required one lifecycle and stale-callback protection but did
  not specify resource authority across asynchronous preparation/start replies.
- **Reach:** NativeCapture/CaptureTermination retain take state; the stream owner
  owns only SDK operations. Selected inputs inherit cancellation and cleanup
  protection without a second take lifecycle or test-only production flags.
- **Verdict:** Sound. Each cleanup acts on the resources it actually owns, and
  obsolete work acquires no authority over a newer take.
- **Confidence:** High.

### Retain attempted SDK resources and join startup before drain — sound, high confidence

When: 21c.

- **Choice:** A screen stream's asynchronous start can acquire a resource before
  returning success or failure. The SDK operation owner records the attempt before
  awaiting it. If discard arrives during that wait, one cached drain task joins
  startup and then stops each attempted stream once, including partial failure.
  It prevents starting the next system-audio stream after drain owns the inputs.
  Caller cancellation reaches only the startup task, with checks before each SDK
  operation; it does not cancel drain. For example, canceling a held video start
  still releases that video after its reply and never opens the audio stream.
- **Gap:** The plan required a single physical drain, but did not specify how a
  pending SDK start or partially acquired failed stream retained that authority.
- **Reach:** ScreenCaptureInput uses this owner for real SDK operations. NativeCapture
  still owns take state and termination; the resource owner has no recording,
  pause, publication, source-allocation or project state.
- **Verdict:** Sound. An error does not prove a resource was never acquired. Joining
  startup then independently draining retains the cleanup obligation and prevents
  both missed and repeated physical stops.
- **Confidence:** High.

## Preserve query authority while preparing owner attribution (2026-10-01)

### Keep the retained query implementation separate from the new worker

- **When:** 24z owner-profile preparation and root integration.
- **The choice:** The slow-query diagnostic used a worker that is now missing.
  Keep that failed measurement and its identity intact. A future CPU profile uses
  the exact retained query code and catalog in a separate checkout, with every
  compiled file and local import checked. A separately identified current worker
  may perform startup workspace cleanup, but the profiled query must invoke no
  native operation. For example, changing camera admission on main cannot quietly
  change the query implementation being profiled. Rebuilding a replacement and
  assigning it the missing worker's authority would conceal a changed input.
- **The gap:** The original worker's loss left attribution unavailable; the plan
  did not specify how to resume that diagnosis while other implementation progressed.
- **The reach:** Future attribution keeps the original measurement, query code and
  new worker identities distinct. The retained checkout must remain available;
  neither its preparation nor a later CPU trace establishes the latency budget.
- **Verdict:** sound; preserves the failed cohort and makes the new experiment's
  authority explicit without replacing a frozen runtime.
- **Confidence:** high. Actual profile dispatch and attribution remain unverified.

### Sample the service through opt-in IPC and retain bounded cleanup

- **When:** the same preparation pass.
- **The choice:** The parent harness sends start/stop messages over its existing
  inter-process channel to the service. The service records its own CPU samples
  only while delivering the requested rows; the parent's comparisons and report
  writing occur afterward. If a read stalls or memory exceeds the operator guard,
  the harness first requests a partial trace and starts transport closure. It
  reserves time for flushing and shutdown, then may stop only its own still-live
  child process. A bare process number can be reused after exit and is not cleanup
  authority. The chosen guards are 60 seconds per arm, 180 seconds overall and
  1 GiB service RSS; they bound this diagnostic, not the product's latency contract.
- **The gap:** The plan required bounded owner attribution but did not prescribe
  sampler placement, interrupted-trace delivery or cleanup ownership.
- **The reach:** Instrumentation is opt-in harness code; normal service operations
  and production schemas remain unchanged. Sampler overhead, idle time and unknown
  frames stay visible rather than becoming a claim of exclusive query CPU cost.
- **Verdict:** sound; measures the intended process and gives interruption a bounded
  cleanup path without adding production instrumentation or raw-PID signaling.
- **Confidence:** high for the ownership decision. Synthetic lifecycle controls pass;
  actual service integration and the query profile remain open.


### Preserve the exact closed mapping inside the source — sound, high confidence

When: 21d (2026-10-01).

- **Choice:** A camera source used to depend on its take's external timestamp file.
  Admission now retains the original closed bytes under the source directory,
  and its receipt identifies those bytes. Deleting the external file or moving a
  portable project therefore leaves the same evidence available. It never reads
  an implicit parent directory or replaces a conflicting local snapshot.
- **Gap:** The plan required self-contained mapping evidence without specifying
  how the original byte identity survived movement.
- **Reach:** Publication, recovery, fresh acquisition import and portable packages
  share the existing publication-member inventory. No new media role or catalog
  is introduced, and later lifecycle work must supply this same evidence.
- **Verdict:** Sound. Keeping the original bytes preserves the evidence's meaning
  without manufacturing another timing representation.
- **Confidence:** High.

### Retain camera facts through the existing journal parser — sound, high confidence

When: 21d.

- **Choice:** Camera proof needs to remember which journal bytes established its
  source identity, common origin and pauses before finalization. The existing
  parser can retain that byte prefix directly; a fake audio callback is no longer
  required to request it. Reading through a supplied prefix always checks its
  length and hash. Later terminal rows may still be appended, but that prefix
  does not attest their state or duration payload. Admission separately keeps the
  complete journal, while the camera verifier refuses later origin/pause changes.
- **Gap:** The plan required shared journal authority, while prefix retention
  previously followed the packed-audio callback rather than the evidence need.
- **Reach:** Audio parsing and its existing defaults remain unchanged. Camera
  proof uses the same torn-tail, sequence and exact-byte interpretation, so
  later producers cannot quietly substitute another parser or clock history.
- **Verdict:** Sound. One parser decides what the journal says; requesting its
  byte identity does not create a second lifecycle owner.
- **Confidence:** High.

### Keep the picture digest's original timescale — sound, high confidence

When: 21d.

- **Choice:** A picture digest includes its exact native timestamp serialized at
  a particular tick rate. New receipts retain that positive native rate along
  with exact rational support. Suppose an older unbound receipt lacks it: the
  verifier may read the actual original raw movie through one held ordinary
  descriptor, check its bytes, and obtain that rate. If the raw authority is gone,
  proof-bearing admission refuses; guessing the canonical movie's rate could
  change the digest's meaning. Neither the old receipt nor its probe identity is
  rewritten to imply production allocation.
- **Gap:** Historical receipts retained the digest but omitted its timestamp
  serialization rate; the plan forbade fabrication without specifying this
  truthful remaining verification boundary.
- **Reach:** New sources are portable without raw media. Historical raw-less
  sources do not gain that claim automatically. Canonical support and offsets
  remain exact rational values rather than projected integer labels.
- **Verdict:** Sound. Verification uses an existing physical authority or refuses
  its missing scope instead of silently changing the preservation contract.
- **Confidence:** High.

### Exercise mapping growth through the actual internal reader — sound, high confidence

When: 21d.

- **Choice:** A real mapping file can grow after it was opened. A deterministic
  fixture opens the existing reader, appends bytes and checks refusal beyond its
  captured boundary, alongside stable and torn input. Only that reader's internal
  package constructor/next operation is visible to the fixture; there is no public
  flag or alternate production path.
- **Gap:** The reader's initial file-size limit alone did not bound subsequent
  reads, and the production consumer needed a meaningful growth control.
- **Reach:** The bounded reader continues to serve publication and admission.
  Its narrow package visibility is an internal fixture boundary, not caller API.
- **Verdict:** Sound. The control observes real-file behavior at the actual owner,
  without asserting internal counters or building a parallel parser.
- **Confidence:** High.

### Share the capture implementation through an editing specialization — sound, high confidence

When: 21f1 durable capture-facts extraction.

- **Choice:** When native reports a finished take, both service paths use the same
  implementation to check its identity, sequence and source duration. The installed
  revision store extends that implementation only to create the first editable
  span or remove its editing rows. Those additions run before the enclosing SQL
  transaction commits: if the lifecycle write fails, its source and editing changes
  are rolled back together. The fresh store has no such editing additions.
- **Gap:** The plan required one surviving capture owner and atomic installed
  behavior without choosing inheritance or composition for the mixed store.
- **Reach:** The fresh service uses the capture store as its one catalog connection;
  the installed service keeps its actual editing owner. Slice 23 can remove the
  editing specialization without copying or replacing capture lifecycle logic.
- **Verdict:** Sound. This preserves the real consumer transaction while avoiding
  forwarding methods, observer-based commits and a second lifecycle or catalog.
- **Confidence:** High.

### Retain the installed recording field until its consumers leave — sound, high confidence

When: 21f1 durable capture-facts extraction.

- **Choice:** The installed app still reads a recording's `currentRevisionId` to
  open its existing edit. That nullable field stays in the shared recording row;
  a fresh capture leaves it null and creates no editing revision. Slice 23 removes
  the field together with the old span and app consumers, rather than treating it
  as permanent metadata for new projects.
- **Gap:** Splitting capture ownership exposed an editing field in the existing
  row shape; the checkpoint had to preserve real installed consumers without
  introducing a migration or a translating wrapper.
- **Reach:** New capture consumers cannot infer project existence from this field.
  Its removal belongs to the explicit hard cutover, and the old library remains
  untouched for deliberate media import.
- **Verdict:** Sound. The temporary field has named live consumers and an explicit
  removal boundary; it does not select a composition or duplicate editing state.
- **Confidence:** High.
