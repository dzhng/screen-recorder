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
  Only source-unavailable can enter that media proof; unknown gaps still fail.

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
