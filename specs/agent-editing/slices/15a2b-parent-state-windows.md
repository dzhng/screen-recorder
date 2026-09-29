# 15a2b — Structural parent domains and authored activation

Status: verified pure metadata checkpoint; [retained evidence](../assets/15a2b-parent-state-windows/README.md). Extends [15a2a](./15a2a-state-domains.md) through the same pure state owner. RNNoise execution remains unavailable; [15a2](./15a2-denoise-prepared-consumers.md) retains channel/native/prepared integration.

## Domain and prefix contract

Clip, track, group and output steps use the existing ordered processing plan. Clip continuity metadata remains clip-only. Parent domains span first through last current structural audio contribution, including authored silence and internal timeline gaps. Neither unrelated video duration nor amplitude nor source availability defines those endpoints. Empty parents have no state input.

Connected authored activation components own state. Anchored clocks and normalized split/trim restrictions are resolved by the existing temporal/curve owner. Structural activity is distinct from source-available support: a missing source interval remains missing evidence inside the authored domain, not invented silence or an implicit state reset. An empty authored intersection produces no component. No selected DSP component acquires source context outside its activation window.

A member selects a target, an exact active interval and the exclusive prefix before its stateful step. Dependencies are only upstream components intersecting that consumed interval. A prerequisite's complete input is expanded from its own members/prefixes, never by extending a downstream caller's prefix. Parent inputs include current processed children, including stateless children. The developmental manifest stores current source inputs and existing processing instructions once; members retain their own prefix boundaries even if another member needs a longer prefix on that target. This metadata is a recipe dependency description, not a single flattened execution schedule.

State eligibility uses the complete structural audio tap plan, then exact member-interval intersection, then prerequisite closure. A range inside a parent's internal gap still selects the parent domain. Dry parent taps omit that parent's processing but retain processed children. Inactive portions do not select that step. Positive exact spans are retained even if sample-clock lowering produces zero samples. Existing visual taps remain independent. Selected state input prefixes also contribute execution requirements through the existing manifest owner, so internal-gap requests cannot bypass unavailable-backend refusal. Returned manifests are detached from revision-local compiler indexes.

## Verification and next gate

Retain clip lifecycle and cycle-repair gates. Verify parent gaps/stateless children, nested routing, active-window full/range selection, normalized split preservation, missing-source separation, empty domains, interval-specific prerequisites and unavailable execution. Independent design/code review and falsified selection/support negatives are required; no native or listening acceptance follows.

Next runtime gate: acquire actual channel provenance through existing source/prepared input owners, prove the initial mono/structural dual-mono policy, then bind the fixed native adapter at these ordered prefixes through existing PreparedAudioStore/JobQueue. Full independent-channel policy, prepared range/full parity, portability/cancellation and quality/listening requirements remain in the parent; this pure checkpoint does not defer them out of scope.
