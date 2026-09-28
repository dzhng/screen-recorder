# 12 — Validate speech cleanup evidence

Status: current local baseline reproduced with frozen partial labels; timing still fails at 135 ms median / 578.1 ms p95. The [matched verbatim alternative](../assets/12-verbatim/README.md) also fails (13/15 matched, subset median 20 ms / p95 352 ms); no engine selected. The [frozen-text alignment trial](../assets/12-alignment/README.md) also fails p95 (15/15 matched, median 35 ms / p95 556.5 ms). The [text-coverage diagnostic](../assets/12-alignment-text-coverage/README.md) fixes the disputed Return onset but still fails p95 (303 ms) and memory; two other unmarked onsets move. Full labels, independent joins and workbench boundary diagnosis remain open. [Evidence](../assets/12-speech/README.md). Dependencies: [00](./00-corpus.md).

## Contract

Determine whether the available local speech/evidence workflow can support the user's requested filler/repetition cleanup and accurate cuts.

## Seam and ownership

Feature-owned reproduction harness over real corpus audio and the current local ASR baseline. Compare a documented local verbatim ASR/alignment alternative only if the baseline fails. Keep editorial choices with an external agent; no semantic editing service.

## Work and review surface

Freeze current output and hand-labeled audible targets/protected words. Measure filler recall, repetition representation and boundary error. Test an external agent using transcript plus targeted waveform/spectrogram/audio; lack of listening capability is reported. Forced alignment may improve supplied-text timing but cannot discover omitted text by itself.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/speech-reproduction.mjs --corpus real-narration
```

## Acceptance

The fixed cleanup task removes every named filler/repetition while retaining protected words; verify cut joins separately. Report timing median/p95, precision/recall and sample counts against independent labels. Compare to the existing failed 135 ms median baseline without treating it as passing. Freeze the selected processing recipe for 12b.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **boundary evidence placement**, using word-edge spectrogram windows with independent marks; output sound quality is a separate listening gate. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If evidence-only inspection misses omitted fillers, reproduce an alternate local verbatim engine then alignment. If all fail, keep the cleanup quality gate incomplete and reslice; do not claim transcript-only matching satisfies the request.

Delegated: Candidate order after the baseline and measurement tooling. Any new model/runtime is pinned and tested locally; acceptance targets cannot be loosened silently.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


[Wider workbench context](../assets/12-boundary-context/README.md) now includes both
alternative endpoints and the unchanged mark. Its metadata-dependent time readout
and missing audible word identity remain explicit; no label or threshold changed.
