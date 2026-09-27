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
