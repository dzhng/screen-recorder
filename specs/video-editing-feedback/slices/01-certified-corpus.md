# 01 — Certify the real-video corpus

Status: complete for the declared corpus scope; physical eight-case verification passes with exact hashes, decoded samples, video clocks and the 250 MiB budget; the scoped behavior ledger, selected frozen07 recognition parity, sampled full-frame picture checkpoints, nine independent controls and the three-source multicam physical-window plus compact decoded-picture verifier all replay green. A caller-authored nine-selection source-choice receipt binds each retained audio window to its same-source picture sample, and the native delivery receipt replays all nine retained picture selections through CLI/MCP and the native renderer. Synchronization, speaker identity and automatic camera choice remain separate gates. Depends on: None.

The [audio checkpoint](../assets/01-corpus-audio/README.md) retains five native-decoder excerpts and refusal controls. Its [selected recognition receipts](../assets/01-corpus-audio/speech-parity/README.md) bind exact original/derivative observations to the frozen integrated07 recipe; later08 window topology requires its own observations. The [picture checkpoint](../assets/01-corpus-picture/README.md) adds full-raster ProRes inputs and physical frame/rational clock refusal controls. The [independent-control checkpoint](../assets/01-corpus-controls/README.md) reuses canonical synthetic media to verify rational boundaries, known offset/drift, unrelated audio, rotated asymmetric pixels, alpha/flat patches, edge landmarks, wrong supplied text, blank input and a transition gap. The exact historical tiny PCM16 input and paired overlap recognition receipts live with [07](../assets/07-speech-timing/README.md). The [multicam physical checkpoint](../assets/01-corpus-multicam/README.md) verifies all retained three-source windows and explicitly refuses a shared clock; its [source-choice behavior receipt](../assets/01-corpus-multicam/behavior-replay.md) binds each caller-authored selection to same-source audio and picture evidence. The [scoped behavior ledger](../assets/01-corpus-behavior/README.md) binds every retained real case to replayable recognition/timing or picture evidence. These checkpoints do not certify global synchronization, speaker continuity, or automatic camera selection.

## Contract

A small, hash-bound corpus reproduces the actual agent feedback and supplies independent negative controls.

## Seam and ownership

Fixture derivation/certification in packages/test-harness; retained inputs under fixtures/video-editing-feedback. Reuse existing isolated source-evidence service fixture; no new service launcher.

Current owners and starting checks:

- [fixtures/README.md](../../../fixtures/README.md)
- [packages/test-harness/editing/source-evidence-fixture.mjs](../../../packages/test-harness/editing/source-evidence-fixture.mjs)
- [packages/test-harness/editing/source-evidence-fixture.test.mjs](../../../packages/test-harness/editing/source-evidence-fixture.test.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Implement the manifest and case-selected generator described in ../fixtures.md. Resolve candidate ranges against original receipts. Verify raw hashes, exact stream/support, derivative clocks and original/derivative behavior. Separate fixed-current regressions from still-reproducing failures. Target about 250 MB and LFS for large media.

## Runnable checkpoint

Manifest verifier plus selected-case baseline report. First useful output is an inventory with measured current dispositions, before changing any product behavior.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Missing LFS bytes, incorrect hashes, unsupported source support, compressed-away failure and transformed timestamps must fail certification. Match the historical speech region and original picture masks; independent controls must refuse changed media bytes and authored oracles. Synthetic controls supplement real cases.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Compression, sample counts and precise excerpt lengths within the user's size/fidelity policy. No invented labels or deletion of original footage.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Baseline classification, fixture byte/clock certification and the retained multicam physical-window checkpoint must pass before any media-dependent production slice. A green multicam coverage report cannot promote synchronization or speaker attribution.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
