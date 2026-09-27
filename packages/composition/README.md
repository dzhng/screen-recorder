# Composition identity and time

This pure package owns authoring identity, placement and source/project mapping.
It accepts admitted stream metadata; it never opens media or a catalog. The
[public entry point](src/index.ts) exports the document schemas and timing API.
Rendering, edits and storage are separate consumers of this model.

`validateComposition(document, assets)` creates a detached, deeply frozen snapshot.
Stored clip and project/content-anchor ranges accept reduced fractional microseconds
when an edit requires them; whole values remain numbers. This preserves the source
mapping when a retimed clip is split. Command coordinates and admitted source
metadata remain integer microseconds. Asset stream bounds and availability use the shared asset clock, including any
leading stream offset. A still image has no invented duration and uses a hold at
source time zero. Effects and captions are rejected until their typed capability
slices land. Canvas background is explicit `#RRGGBBAA`.

`resolvePlacement(model, clipIdOrAnchor)` returns an exact placement envelope and
its disjoint available intervals. Rational numerators/denominators are `bigint` in
this internal timing API; authoring schemas remain JSON-safe. Keeping fractions
until sampling avoids drift when several attachments divide the same interval.
A source gap does not shorten the envelope or become acquired silence. Anchored
children inherit their parent's unavailable intervals.

`projectToSource(model, atUs)` returns every active occurrence, including unavailable
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
