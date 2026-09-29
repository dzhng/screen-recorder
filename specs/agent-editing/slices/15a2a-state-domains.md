# 15a2a — Revision-owned clip state domains

Status: verified pure metadata checkpoint; [retained evidence](../assets/15a2a-state-domains/README.md). Dependencies: [15a1](./15a1-denoise-entry-parity.md), existing processing/edit/compiler owners. This is a pure metadata checkpoint; no denoise execution or mono/stereo admission is enabled.

## Identity and edits

Keep unique target-owned step IDs for addressing. A stateful step without `stateKey` is an independent instance; an explicit key denotes shared continuity in a distinct identity namespace. First split writes the newly allocated child step ID as shared key on both original and child. Existing shared splits and replacement padding preserve membership. No new allocator, registry or ancestor lookup exists. The new child ID prevents a detached token owner from reconnecting former siblings when split again. Live shared tokens reserve their identifier in the existing edit allocator, even if the original owning instance was deleted.

Fresh placement and standalone duplicates are independent. One duplicate operation maps copied members of each shared group to a fresh copied-member token, preserving mutual continuity among those copies on the same track, independent of originals and other duplicate operations. Omitted metadata on an existing `processing.set` preserves membership; explicit metadata can only roundtrip that instance's current membership. Stateless conversions remove it. Ordinary upstream gain changes preserve shared state and change the current recipe; no prefix-equality test may detach them.

At each completed edit operation, normalize changed resolved occurrences, including attached/ripple-shifted ones. An entire shared group moved together to one track stays shared. A partial cross-track move detaches changed occurrences; clearing their explicit key makes them independent without rewriting survivors. Existing same-track overlap rejection remains. Stateful reordering or changed domain coverage that creates dependency cycles detaches participating changed occurrences with monotonic bounded repair, then revalidates. Adding/removing steps is not itself reordering. Ordinary processing changes in receipts expose the consequence. Imported invalid domains fail validation without edit repair.

## Compiler contract

Derive from the complete current revision, then select requested tap domains and their prerequisites. Pure splits preserve one connected domain; independently authored matching clips remain separate. A right-child processed tap can need earlier sibling input; its dry tap must not. Domains are connected exact project spans, lowered through the existing sample clock. Positive spans with zero output samples must remain well-defined and never cause unbounded work.

The first authorable variant is fixed RNNoise on whole clip targets, unavailable for execution. Domain members retain their current source/silence meaning, resolved range and availability, and actual ordered prefix. Trim/removal recomputes these inputs; old source envelopes or prepared output never define them. Structural gaps and disabled members separate domains; explicit silence padding participates. Source/ancestor availability remains explicit missing support, not newly invented silence or accepted DSP admission.

Dependency nodes are connected domains, not shared keys. Derive their edges from enabled current prefix stateful steps; reject cycles and never move clip processing to a parent. Stateless manifests retain their existing shape. No model, prepared-store or renderer authority is added.

## Verification and continuation

First tracer: split versus independently authored matching clips. Add trim, duplicate group/standalone, silence padding, omitted-key gain edits, bypass/re-enable, original token-owner detach/resplit, root deletion, allocator collision, full-group move and partial cross-track move. Verify current differing prefixes and multiple stateful steps under reorder/add/remove, cycle repair, fractional boundaries, full/range/tap consistency and unavailable execution. Independent design/code review is required; all statements concern metadata, not audible parity.

[15a2](./15a2-denoise-prepared-consumers.md) retains parent scopes, connected active windows, channel admission, model/prepared-consumer integration and the full ordered-stack contract. Those are deliberately not represented as verified by this first leaf.
