# 12 — Verify joins and repair through the agent

Status: checkpoints A–C are implemented and reviewed; the bounded consumer repair
helper for C/D is implemented, while a fresh-agent discovery run remains open. Depends on:
[10](10-alignment-and-boundaries.md), [11](11-rendered-speech.md), [06](06-exact-removal.md).

## Contract

An agent can discover truncated speech and investigate conflicting checks using a contextual report, then explicitly repair authorized cuts.

## Seam and ownership

Read-only join report over composition cut events, selected source/output audio, waveform/spectrum, alignment and rendered speech; skill owns repair decisions.

Current owners and starting checks:

- [packages/composition/src/project-cuts.ts](../../../packages/composition/src/project-cuts.ts)
- [skills/yap/scripts/review-bundle.mjs](../../../skills/yap/scripts/review-bundle.mjs)
- [skills/yap/references/editorial-checks.md](../../../skills/yap/references/editorial-checks.md)
- [packages/test-harness/speech-boundaries.mjs](../../../packages/test-harness/speech-boundaries.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Define join.verify with pinned revision/tap, explicit boundaries/expected text and context budget. Return evidence/disagreement/coverage per source side and rendered side, including opening/ending. Include padded-window recognition and controlled nearby candidate offsets, acoustic edge activity, room-tone/discontinuity and alignment evidence. Do not apply an edit, fixed timing offset or universal fade. Skill uses bounded attempts/no-progress stop and keeps more retained audio through measured quiet when appropriate; rechecks changed output and reports exact remaining uncertainty.

## Implementation checkpoints

- A: extend the existing composition cut owner with explicit two-sided boundary
  lookup. Opening, ending, continuous splits and caller-selected candidate points
  retain exact project/source clocks. A review point does not author a cut, assert
  available media or identify speech. [Boundary evidence](../assets/12-contextual-joins/README.md)
  owns its focused tests and retained falsifications.
- B: publish the read-only `join.verify` report over pinned revision/tap and
  explicitly prepared source/rendered evidence. Reuse retained generation reads;
  this report creates neither another inference scheduler nor an edit. Return
  complete observed operands, disagreement and missing coverage instead of a
  clean-cut verdict inferred from matching text. Ordinary public preparation
  requests supply padded recognition and caller-selected nearby candidates. The
  reviewed implementation also uses the exact sample clock, an identity-bound
  prepared-file lease, bounded waveform/spectrum reads, unavailable-span refusal,
  and the request cancellation signal.
- C: exercise clipped, intact-but-abrupt, repaired and intentional-jump outputs
  with complete expected wording, acoustic/context evidence and exact delivered
  sample support. Preserve the frozen Parakeet word-completion limitation. Source
  energy and conditional alignment remain insufficient phonetic identity.
- D: a fresh agent discovers the withheld edge defect without a timecode hint,
  performs explicit bounded repairs within its brief and rechecks changed output.
  Keep no-progress stop and all original lexical/physical acceptance gates. The
  consumer helper [join-repair.mjs](../../../skills/yap/scripts/join-repair.mjs)
  applies exactly one caller-authored `edit.apply`, optionally prepares the new
  revision's audio tap with bounded polling, then calls `join.verify` against the
  changed revision. It never chooses a cut, retries failed work, or treats the
  report as permission to edit.

These checkpoints split verification order; they do not reduce the slice's scope.

## Runnable checkpoint

Run `YAP_NATIVE=<worker> node packages/test-harness/editing/contextual-join-fixture.mjs
--out <directory> --model <prepared Parakeet directory> --native <worker>`.
The harness uses the isolated output directory as its managed home, prepares the
pinned first-class Parakeet model from the supplied directory, and records the
clipped, intact, repaired and intentional-jump cases in
[media-fixture-report.json](../assets/12-contextual-joins/media-fixture-report.json).
The intentional jump's rendered recognition is expected to refuse when a word
estimate falls outside the delivered interval; `join.verify` still reports exact
audio support and missing recognition rather than treating the jump as silence.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Agent must discover withheld edge defect without a human timecode hint. ASR-only missing word and isolated snippet are not sufficient proof; source energy is not lexical identity. Verify complete expected wording, sample support, no duplicated speech and intentional pauses. No human-QA request or blind retry loop.

Variable: evidence alignment/coverage only. Mask: bounded join timeline and source/output axes; grading, captions and final montage aesthetics are out of scope.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

The focused helper checkpoint passes with explicit edit/recheck receipts and a
revision-advance refusal. See [repair verification](../assets/12-contextual-joins/repair-verification.json).
The real media exercise passes with exact prepared sample support and fresh
Parakeet recognition for the intact, clipped and repaired revisions; its lexical
comparison remains observational and `phoneticCompleteness` stays `unknown`.
The fresh-agent discovery and helper-driven repair run remain the next acceptance
gate; an unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Evidence report presentation and candidate spacing within a frozen work budget. Editorial corrections follow the brief and remain explicit revisions.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

No source mutation, no product editorial policy, unchanged checks reused, and useful candidate delivery with precise uncertainty rather than false certainty.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
