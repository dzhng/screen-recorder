# Agent-operated editing primitives

Released for personal use on 2026-10-03. The user authorized closing the spec and
releasing the app without waiting for further product testing. The installed
macOS app and its CLI are the release; models remain explicitly prepared local
prerequisites. [Release disposition](release-closeout.md) records the installed
identity, completed checks and accepted limitations.

## Purpose and boundary

The toolkit gives an external agent evidence and non-destructive operations for
recording, inspection, composition, processing, local speech generation and export.
It makes zero editorial decisions. A detected filler or repetition supplies
information; the caller decides whether and how to change it. Source media remains
intact, and an edit is an explicit, revision-bound request.

This boundary also governs development. Real recordings are fixtures for testing
primitives, not an invitation to choose a preferred edit for their owner. The
[editorial-control contract](architecture.md#editorial-control) defines the division
between caller intent and deterministic execution. The consumer
[screenrec skill](../../../skills/screenrec/SKILL.md) belongs to that external caller.

## Why this shape

A shared composition model prevents the app, CLI and MCP from inventing different
meanings for an edit. Pure authoring and timing live in
[composition](../../../packages/composition/README.md); storage, immutable revisions,
source evidence and publication live in the existing core/service owners; native
workers execute compiled media requests. [Architecture](architecture.md) explains
those ownership boundaries, and [contracts](contracts.md) retain the rules that
must agree across them.

Exact fractional time preserves admitted physical endpoints and retimed selections
through later edits. Rounded inspection labels are conveniences rather than
execution authority. Missing source support stays inspectable instead of becoming
invented pictures, words or acquired silence. Speech recognition timings remain
estimates; a caller can inspect the original sound and provide exact cuts.

Processing is one ordered stack on each target. Children combine before a parent's
stack, and selected taps distinguish the target's dry input from its processed
result. Stateful preparation derives its inputs from the current revision rather
than an old cache. [Processing](processing.md) records these invariants and the
tradeoffs behind retained, relocatable results.

Capture produces independent source facts and publication receipts. It does not
create a project or choose a presenter layout. Physical input closure, source
publication and later acquisition are separate outcomes, so one source can be
usable while its sibling needs retry. The
[native capture owner](../../../helpers/mac/README.md) and
[service](../../../apps/service/README.md) own their actual lifecycle.

Durable request identity makes uncertain writes recoverable without repeating an
edit. Large responses use complete leased delivery rather than truncation or a
second mutation. Media readers retain their own lifetime, and explicit cancellation
joins the work that still owns files before cleanup can remove them.

## Decisions and rejected approaches

The [choices ledger](choices.md) records the surviving implementation decisions,
with concrete scenarios and confidence. It was reconciled against the shipped
source; corrected proposals and temporary owner-removal sequencing are not current
architecture.

Automatic editorial cleanup, a separate recording edit interpreter and competing
preview/export models were rejected because they would split intent or timing
ownership. Historical PNG byte equality cannot certify physical synchronization
or perceptual quality across different decoders and codecs. Corpus text and
model-generated timestamps cannot supply independent audible word boundaries.
These distinctions prevent evidence from claiming more than it establishes.

## Retained evidence and visual standards

The [preservation registry](assets/23-owner-fixture-ports/README.md) binds completed
source/publication/delivery and scale checks to their actual candidates. The
[release acceptance record](assets/acceptance-maintenance/release-gates.md) preserves
unverified speech, physical, listening and contention facts as accepted release
limitations. Original failures remain failures; no full-green repository run is
claimed.

[Reference-style evidence](assets/reference-style/README.md) retains the supplied
video's role in the caller's visual brief. The
[fresh caller visuals](assets/25b-fresh-caller/fresh-visual-review/README.md) and
[saved temporal comparison](assets/25b-fresh-caller/temporal-review/README.md) retain
original full frames, comparison references and caption/still/zoom boundaries.
Those are fixture standards, not product-authored styling defaults.

The original build plan is retained in
[Git history](https://github.com/dzhng/screen-recorder/tree/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing).
Archived producer scripts and manifests preserve their original paths and bytes;
the current [verification harness](../../../packages/test-harness/editing/README.md)
owns executable reproduction. Large complete operands kept outside Git retain their
explicit local archive identities and transfer obligations.
