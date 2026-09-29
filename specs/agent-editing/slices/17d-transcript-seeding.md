# 17d — Occurrence-specific transcript seeding

Status: verified within the retained public edit/relocation, fresh skill and scoped
visual evidence. Evidence is retained in
[17d assets](../assets/17d-transcript-seeding/README.md). Depends on verified literal
text17c and retained source transcript evidence. The parent17 caption contract has evidence through this checkpoint;
audio stretch readiness and speech accuracy remain separate gates.

`text.seed` is a core convenience beside `edit.apply`: resolve explicitly pinned
word occurrences and expand one atomic batch of ordinary text placement operations.
The caller chooses cue groups, separator, typography and anchor domain. No sentence
heuristic, house preset, alternate timeline or second edit interpreter is added.

A text clip retains immutable source-generation and selected-occurrence origin
separately from editable literal/style. `text.set` preserves that origin without
claiming the corrected text is still the transcript. Split/copy keep the origin
while the existing anchor graph determines the new occurrence's timing. Original
clip IDs can disappear from the current document; their origin proof remains in
retained history. They do not acquire project/revision IDs needing package remaps.

New or changed provenance validates against the pre-edit occurrence and retained
source generation. Every revision insertion validates the selected word pins and
retains the existing transcript-generation resource in its transaction. Adoption
validates occurrence origin against its bounded retained history. An absent or
mismatched generation is a typed refusal, never an optional test-only capability.
Inject the existing transcript owner into ProjectStore and use its bounded reads.

Public proof must seed repeated speech twice, preserve anchor timing through
split/trim/retime/repeat, leave source words unchanged after display correction,
reject false/missing word/generation/origin pins, replay one edit, and preserve
source/font dependencies through removal, restart, history, relocation and undo.
Audio stretch readiness remains a separate gate. Capture actual PNG/movie output
and retain fresh visual and product-skill review before closing parent17.


Exact-time revision: text placement uses the existing reference-aware exact anchor
schema, preserving fractional endpoints from retime and partial-word selection.
Other placement/movement command coordinates remain unchanged. Source word pins
stay integer source timestamps. The reproduction first refused those exact text
placements, then passed project and partial-content cases without rounding.

Dependency closure includes seed source assets/acquisitions as ordinary document
resources and the exact transcript generation as a revision resource. Protecting
only generation GC would not protect the original asset/context lifecycle.


## Reviewed choices

The core owns occurrence resolution and expands into the existing atomic edit
executor; service adapters only validate and dispatch. Caller-selected grouping,
separator and style avoid embedding editorial caption policy. The exact retained
source records own word text and identity; the composition stores only explicit
pins and independent editable text.

A new origin is checked against the pre-edit document, while inherited origin
may survive parent removal. Package adoption checks against retained preceding
history. This keeps provenance truthful after ordinary edits without requiring
an immortal source clip or rewriting source transcript evidence.

The source asset and acquisition context join the shared document dependency
extractors. The transcript generation uses the existing revision resource owner.
Generation retention alone does not pin original asset/context lifetimes. Fonts
continue through the same immutable asset closure as literal captions.

Text placement alone accepts the reference-aware exact anchor schema; this is an
intentional public-contract revision approved for source-derived fractional
endpoints. Other authoring coordinates retain their current contracts.

Review found no new store, clock, timeline or native raster cache. The added core
module owns seed resolution/validation; ProjectStore remains the transactional
revision owner. Test fixtures inject the real transcript owner rather than an
optional production bypass. Independent code review's optional-field type finding
was fixed and typechecked. Fresh discovery inspection corrected a read-only
annotation accidentally inherited by required cue input words; persisted origin
pins remain immutable.
