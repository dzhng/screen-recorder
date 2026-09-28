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
