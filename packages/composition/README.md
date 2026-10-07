# Composition identity, time and edits

This pure package owns authoring identity, placement, clock mapping and atomic
structural edits. It consumes admitted metadata without opening media or a catalog.
The [public entry](src/index.ts) owns exported schemas and APIs; the
[reducer](src/edits.ts) applies ordered batches. Persistent transactions and replay
belong to [core](../core/README.md).

## Sources and occurrences

A clip is an occurrence, not an asset identity. Its explicit acquisition context
can constrain source availability without changing byte identity. Physical support
and acquired intervals resolve before placement and ancestor intersection; omission
of an acquisition binding cannot silently select a capture context.

One resolved availability feeds projected evidence, pictures and PCM. A source gap
cannot disappear when changing inspectors, shorten the placement envelope or become
acquired silence. Children inherit unavailable ancestor support. Still images and
literal text have no invented playable duration or source clock; authored silence
has duration but no media source. A schema owns the allowed anchor and hold forms.

## Exact clocks

Retain rational coordinates until a sampling boundary. Retimed selections and
attachments can end between integer microseconds; rounding the stored document
would change later splits and source mappings. Removal uses the same exact
selections as placement so a fractional frame can be deleted without changing
its surviving neighbors. Other structural command coordinates retain their own
integer constraints, defined by the [edit input schema](src/edits.ts).

Source and project time are different clocks. A rounded forward query can map many
project instants to one source bin; the reverse is therefore an interval, not a
single invented inverse timestamp. Stream offsets share the asset presentation
origin. Missing support and a known source with no occurrence remain different
from invalid identity.

[Editorial boundaries](src/project-cuts.ts) use the same source mapping for
authored cuts and explicit two-sided review points. Opening/ending and nearby
candidate coordinates stay exact; asking about a point never authors a cut or
proves that its source media is available.

[Source projection](src/source-projection.ts) preserves retained fragments and
completeness in an immutable revision. Completeness describes the original source
range surviving in an occurrence, not whatever smaller display window was later
requested. Repeated uses must remain distinct through evidence queries.

[Caption sidecars](src/caption-sidecars.ts) serialize explicitly selected displayed
text using resolved surviving support. Transcript word timing and clip envelopes
cannot replace that support. Millisecond rounding encloses each exact fragment;
new overlaps are reported, while genuine overlaps keep their authored meaning.
Plain subtitles discard visual styling. Format-specific refusal protects literal
text when a reader could interpret it as formatting rather than silently rewriting it.

## Routing, processing and curves

Processing groups define combination; synchronization groups define linked editing.
Routing changes do not retime media. Ordered processing belongs to the target and
runs after children combine. Empty and bypassed stacks preserve their defined
identity rather than introducing unrequested fades or gain policy.

[Curves](src/curve.ts) retain their original evaluation domain across cuts;
[temporal processing](src/temporal-processing.ts) exposes the same boundaries to
inspection. Consumers must not restart animation or duplicate anchor math.
[The processing rationale](../../specs/done/agent-editing/processing.md) explains
state continuity and retained preparation dependencies.

Static SDR correction uses source-neutral white correction, exposure, then
contrast/saturation and then shadow/highlight recovery in that order. Recovery
amounts start at identity zero; enabling one does not request the other. It preserves alpha and extended working values
until the existing output conversion. Source-neutral temperature describes the
white being corrected toward the recipe's target, not a camera-calibrated warmth
slider. Temporal windows and curves are not admitted for this static processor.
The [reproduction](../../specs/done/ffmpeg-parity/evidence/sdr-correction) owns the
measured provider semantics and limits; operation discovery owns parameter bounds.

An explicitly imported LUT is an immutable processing dependency, even when its
step is bypassed or retained only in history. It has no invented stream or
clock. [The LUT contract](src/lut.ts) requires the caller to declare the color
interpretation; raw .cube text does not identify a camera profile. Ordered LUT
steps share the same compilation and tap boundaries as other picture processors.
[The native parser and recipe](../../helpers/mac/Sources/YapFrames/README.md)
own supported file semantics and measured output.

## Compilation is distinct from readiness

[The compiler](src/compiler.ts) indexes an immutable revision and compiles requested
windows. Picture sample time stays distinct from clipped visible support; a preview
beginning inside a frame retains the absolute project phase. Audio schedules retain
whole source mappings while limiting delivery to selected sample bounds.

Selected taps preserve their target's defined processing scope. Dependency manifests
retain exact revision, rendition, source and implementation requirements. A pure
plan does not prove a native executor or prepared resource exists; unavailable
requirements refuse rather than silently selecting another result.

Resampling context comes from current retained support: splitting cannot restart
its filter, while removing material cannot leave hidden input. Stateful continuity
is a separate domain compiled from the current graph before choosing the output
window. Neither an old cache nor caller-supplied grouping metadata defines it.
The [state-domain owner](src/processing-state.ts) preserves those inputs once.
Static stateful recipes retain complete domains and resolved detector prefixes;
a window cannot restart preparation. Detector tap ordering follows the same
mixed-media stack as inspection. Self-detector splits retain member-relative
endpoints; externally referenced detector clips require a stable track or group
tap before partitioning. A bypassed detector never adds preparation input;
missing support and a clip tap wholly outside its domain refuse.
Authoring and execution availability remain distinct;
[native execution](../../helpers/mac/README.md) owns actual filtering and publication.

[Compiled record schemas](src/compiled-records.ts) are the shared native boundary.
They prevent the worker from adopting a second timing or processing policy.
Text records carry resolved active glyph ranges; authored word windows stay in
the composition clock. Caption entrance motion uses the same anchored geometry
and opacity curves as other pictures, so clipping an output window cannot restart it.
[Preservation evidence](../../specs/done/agent-editing/assets/23-owner-fixture-ports/README.md)
records scoped downstream proof separately from pure authoring validity.
