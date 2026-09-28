# Composition identity, time and edits

This pure package owns authoring identity, placement, source/project mapping and
atomic structural edits.
It accepts admitted stream metadata; it never opens media or a catalog. The
[public entry point](src/index.ts) exports the document schemas and timing API.
Rendering and storage consume this model. The [reducer](src/edits.ts) applies
ordered batches and reports their exact expansion without opening a catalog.

`validateComposition(document, assets)` creates a detached, deeply frozen snapshot.
Stored clip and project/content-anchor ranges accept reduced fractional microseconds
when an edit requires them; whole values remain numbers. This preserves the source
mapping when a retimed clip is split. Command coordinates and admitted source
metadata remain integer microseconds. Asset stream bounds and availability use the shared asset clock, including any
leading stream offset. A still image has no invented duration and uses a hold at
source time zero. Unsupported processing variants and captions are rejected until their typed capability
slices land. Canvas background is explicit `#RRGGBBAA`.

`resolvePlacement(model, clipIdOrAnchor)` returns an exact placement envelope and
its disjoint available intervals. Rational numerators/denominators are `bigint` in
this internal timing API; authoring schemas remain JSON-safe. Keeping fractions
until sampling avoids drift when several attachments divide the same interval.
A source gap does not shorten the envelope or become acquired silence. Anchored
children inherit their parent's unavailable intervals.

Authored silence is an audio occurrence without an asset or source clock. It
contributes duration and participates in ordinary edits; source queries omit it.
Normalized anchors can follow silence, while content anchors require a source
clock. Explicit padding produces linked ordinary pieces and reports their lineage,
so selected edits can address one piece and linked edits carry the full envelope.

`projectToSource(model, atUs)` returns every active media occurrence, including unavailable
ones with `available: false`. It floors source time only at this query boundary.
`sourceToProject(model, {assetId, streamId, atUs})` returns every occurrence's exact
project interval corresponding to that source microsecond bin. A held source bin
maps to its whole placement. `firstProjectUs` is the first integer project time in
the interval, or null when fast playback skips that bin at microsecond resolution.
This interval form preserves the many-to-one relation created by flooring rather
than pretending an inverse is a single exact timestamp.

Forward queries are ordered by placement start, track order and clip ID; reverse
queries use the mapped occurrence start rather than its containing clip start. A half-open end
belongs to the following clip. Unknown clip/source identities and invalid times
throw typed `CompositionError`s; a known source/time without an occurrence returns
an empty list. Invalid documents use `INVALID_COMPOSITION`, including anchors
outside the parent's selected source and dependency cycles. Structural edits must
partition/rebase attachments before validating their resulting document.

Odd canvas sizes are valid authoring geometry; codec limits belong to execution.
Synchronization records preserve unequal offsets and lengths without changing
placement. The reducer slice owns linked edit expansion. Point queries currently
scan resolved occurrences; the bounded compiler/index slices own indexed queries.

The [corpus probe](../test-harness/editing/composition.mjs) checks the independent
membership oracle and prints repeated-source reverse lookup after building this
package. The test suite additionally exercises exact fractions, source gaps,
held media, invalid identities and a range of reversible point mappings.

Processing groups organize how tracks combine; synchronization groups organize
which clips edit together. Routing changes leave media timing untouched. The
[routing owner](src/routing.ts) validates the parent forest and derives the leaf
order shared by evidence and compilation. The [processing owner](src/processing.ts) validates target-owned ordered stacks
and preserves configuration across structural edits. Get/set and constant audio
gain authoring are available in this pure package; capability discovery explicitly
distinguishes that from native execution, which remains unimplemented.

The [compiler](src/compiler.ts) builds an interval index once for a validated
immutable revision. Frame iterators keep absolute project phase, including the already-visible picture
when a window begins between frame timestamps. Sample time remains distinct from
the clipped visible interval; audio schedules
clip absolute sample bounds while retaining the whole source/placement mapping.
Frame availability distinguishes own-source absence from missing ancestor support;
ancestor absence cannot be repaired by proving an empty edit in the child file.
Unavailable media remains marked, and missing contributors represent background
or silence rather than invented source evidence. Processing instructions retain
ordered steps and combine children before their parent stack. Their list is
restricted to window contributors and their ancestors, so a late preview does
not materialize earlier frames or unrelated processing branches.

The compiler binds a revision identity once. Its window request selects a target's
dry, after-step or processed result; dry preserves child processing and excludes
only that target's stack. A window's source schedules are built from selected
descendants, so inspecting one track does not repeatedly resolve sibling media.
The strict manifest carries the rendition, source mappings and ordered dependency
requirements that storage can use to identify work. Unresolved native executors,
processors and retiming remain explicit requirements; the readiness guard fails
rather than treating a descriptor as prepared media. Raw source evidence remains
separate from target taps.

These are pure schedules and dependency manifests, not native readiness claims.
The [compiler slice](../../specs/agent-editing/slices/05-compiler.md) records pure
conformance and names the downstream native/media acceptance owners. Streamed
records derive their types from [strict schemas](src/compiled-records.ts), so worker
adoption cannot silently add a second timing or processing policy.
