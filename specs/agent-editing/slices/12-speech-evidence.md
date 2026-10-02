# 12 — Validate speech-evidence primitives

Status: broader quality characterization remains incomplete. The
[selected Parakeet baseline](../../recording-for-ai/slices/04-local-speech-gate.md)
is current behavior under the user's best-effort filler policy; no alternate
ASR/alignment recipe is selected. Historical
[baseline](../assets/12-speech/README.md), [verbatim](../assets/12-verbatim/README.md)
and alignment trials below retain their failed quality gates and frozen scores.
Actual sentence/workbench marks now support a separate
[eight-edge comparison](../assets/12-human-frozen-comparison/README.md) that passes
scoped alignment timing. Full inventory, omitted text, other protected words,
independent joins and held-out quality remain open. The
[repetition-intent solicitation](../assets/12-repetition-intent/README.md)
is retired as a development prerequisite. Dependencies: [00](./00-corpus.md).


The [retained-sentence recognition case](12h-retained-sentence-recognition.md)
represents the opening `um` and inherited words, but fails its six independent
edge timing gate. Its [root owner audit](../assets/12h-retained-sentence-recognition/merged.json)
finds no supported coordinate correction; raw engine estimates already contain
the errors. This separate input context does not explain the historical omission
or select a replacement recipe.

## Contract

Verify that local transcript, timing and inspection primitives expose useful
speech evidence and that explicit caller-selected cuts execute accurately.
The product makes zero editorial decisions; the external agent using it decides
what to remove. It does not classify a repetition as unwanted or construct an
editorial cleanup plan. See [editorial control](../architecture.md#editorial-control).

## Seam and ownership

Feature-owned technical measurements over real corpus audio and the selected
local ASR baseline. Preserve raw recognition and treat word times as estimates,
not guaranteed safe cut points. Alternate ASR/alignment is a separately justified
improvement experiment, not a prerequisite for exposing unchanged primitives.
The external caller can inspect audio/waveforms and supply exact cut ranges.
No semantic editing service or complete-filler-recall guarantee is introduced.

## Work and review surface

Freeze current output and hand-labeled audible targets/protected words. Measure filler recall, repetition representation and boundary error. Test an external agent using transcript plus targeted waveform/spectrogram/audio; lack of listening capability is reported. Forced alignment may improve supplied-text timing but cannot discover omitted text by itself.

The [retained corpus evidence](../assets/12-speech/README.md) and
[independent utterance diagnostic](12j-external-lexical-diagnostic.md) provide
bounded checks through the selected speech owner. Use the existing shared
[measurement owner](../../../packages/test-harness/speech/evaluate.mjs); do not
create a parallel scorer or pass text-only references through timing acceptance.

## Acceptance

An explicit fixture edit removes exactly its declared target ranges while
preserving declared protected words; verify cut joins separately. Fixture targets
are supplied test inputs, not conclusions that the engine must draw about the
speaker's intent. Measure lexical/filler coverage and timing median/p95 against
independent acoustic labels, with sample counts and omissions reported. Preserve
the existing failed baseline and unchanged timing thresholds. Freeze a justified
replacement speech-evidence recipe only if the evidence justifies changing the
selected baseline. [12b](12b-speech-processing.md) can verify unchanged baseline
parity while broader quality remains open; that does not pass these measurements.
No editorial-removal policy is selected. The
recording owner's personal keep/remove judgment is not an acceptance gate.

The [readiness audit](../assets/acceptance-maintenance/speech-readiness.md) names
which missing facts can reuse saved outputs and which need independent reference,
listening or resource evidence. More numerical examples do not resolve those gaps.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **boundary evidence placement**, using word-edge spectrogram windows with independent marks; output sound quality is a separate listening gate. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

Missing acoustic ground truth remains a named limit; do not create a personal
editing/annotation assignment to manufacture completeness. Start another model,
alignment or label trial only for one necessary unresolved technical question,
with fixed inputs and a stopping condition, within existing authorization. Reuse
accepted labels and outputs. Report the baseline's misses honestly; do not reopen
its selection automatically or imply alignment discovers omitted words. A changed
recipe cannot be adopted from a partial timing pass alone.

Delegated: Candidate order after the baseline and measurement tooling. Any new model/runtime is pinned and tested locally; acceptance targets cannot be loosened silently.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


[Wider workbench context](../assets/12-boundary-context/README.md) now includes both
alternative endpoints and the unchanged mark. Its metadata-dependent time readout
remains historical evidence. The [actual human workbench range](../assets/12f-human-marks/README.md)
now resolves that disputed reference separately; no historical label, score or
threshold changed. The [comparison on eight actual human edges](../assets/12-human-frozen-comparison/README.md)
still fails baseline timing and passes timing for all three frozen alignment
conditions on that cohort only. The omitted opening “um”, incomplete inventory,
other protected words/joins and held-out quality remain unverified. No alternate
ASR/alignment recipe is selected. The [original repetition context](../assets/12-repetition-intent/README.md)
is historical source-preservation evidence; its unanswered editorial question
does not block the toolkit and must not be restarted as development work.

[The precision diagnostic](../assets/12-alignment-precision/README.md) reduces peak
resident memory to 3,574,104,064 bytes using float16 with the original frozen text.
All marked errors are unchanged and timing still fails; one unmarked onset moves
80 ms. This is a provisional numerical candidate, not production or listening
acceptance. The larger OS footprint remains separately reported.

[The complete-sentence packet](12d-complete-sentence-cleanup.md) replaces the
cropped filler presentation while preserving its original evidence. It verifies
one explicit cut accepted by the user as clear and natural, now reproduced exactly
through managed public CLI/MCP editing, preview/export and undo. Independent
sentence/neighbor labels are now [reconciled](../assets/12d-human-marks/README.md),
including exact marked protected-word preservation and the retained 15 ms filler
prefix. Other labels/joins and broader cleanup acceptance remain open.

The [boundary redraw owner](../assets/12-boundary-context/README.md#annotation-integrity)
now preserves absolute human mark times when compatible candidate timestamps move,
and refuses incompatible reuse before overwriting evidence. This corrects a tool
integrity hazard; the later independent human range supplies the word reference.
Neither change improves the recorded historical speech timing scores.

[Bounded external lexical-reference qualification](../assets/12-lexical-reference-qualification/README.md)
retains one independently verified human text source whose missing interval
authority prevents an executable small fixture. It adds no quality pass.

The [independent utterance diagnostic](12j-external-lexical-diagnostic.md) adds
human-checked lexical coverage over 24 complete acted utterances, including 41
explicit filler labels. It retains every recognition miss and eight negative
utterances. Sampling is enriched, one voice supplies the material, pretraining
exclusion is unknown and no independent acoustic edges are supplied. This broadens
lexical characterization without closing held-out timing, listening or adoption.

The [independent manual-word example](12k-independent-word-timing.md) adds ten
edge observations at six distinct human times. Unchanged Parakeet recognizes all
five words and meets the existing numerical timing criteria on that case. The
full shared evaluation remains pending: it supplies no fillers, walkthrough,
audition or model-training exclusion. Its preparation-only directory timeout and
restored previously executed directory are separate actual runs, not a causal
cache or host result. No further recognition is queued for that example.

The [independent supplied-text candidate](12l-independent-supplied-text-timing.md)
improves the same manual example to 30 ms median and 40 ms p95/max without any edge
regression. Three observations change at only two distinct human times; seven
stay unchanged. Full sample equality through the existing format bridge, the
finite converter clock and original model/runtime preservation are qualified.
The complete shared evaluation remains pending. This is timing characterization,
not omitted-word discovery, broad speech acceptance or a selected replacement.
