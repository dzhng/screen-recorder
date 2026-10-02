# Speech implementation and missing release evidence

The unchanged selected baseline already has its public implementation proof in
[12b](../../slices/12b-speech-processing.md). Another recognition or alignment
example does not resolve the remaining parent-12 requirements. No replacement
recipe is selected, and no accepted inference or listening cohort needs replay.

[12j](../12j-external-lexical-diagnostic/README.md) retains complete predictions and
human-checked lexical references, including omissions, fillers and restart labels.
Its text-only diagnostic can characterize those occurrences without inference.
It cannot establish their acoustic edges or physical attribution of identical
repetitions. The independent timing examples in
[12k](../12k-independent-word-timing/README.md) and
[12l](../12l-independent-supplied-text-timing/README.md) do not supply that missing
broader reference.

The next useful quality prerequisite is a complete independent acoustic reference,
including omitted words and ordinary neighbors. The developer owns qualifying
existing independently labeled material for the unmet coverage requirements;
absence of acoustic labels for 12j does not require a user annotation task or
prevent qualification of another corpus. Preserve 12j's fixed lexical evidence
and report new corpus scope separately. Neither ASR nor alignment may manufacture
its own reference, and labeling only recognized words would bias the denominator.
Once qualified labels exist, the
[shared evaluator](../../../../packages/test-harness/speech/evaluate.mjs) can score
existing predictions. Missing reference data remains a fact, not another model
trial or an automatic assignment to the user.

The [accepted explicit cut](../12e-labeled-cleanup/README.md) already preserves its
marked protected words, original PCM and undo; its listening verdict applies to
that candidate. Broader protected ranges and new joins need independent references
and actual listening evidence. Numerical clocks or exact PCM cannot provide it.

The full evaluator also requires its canonical/held-out, silence, technical-name,
audition and qualifying warm-walkthrough coverage. The
[historical resource evidence](../../../recording-for-ai/assets/speech/boundaries/README.md)
retains its actual concatenated narration and model-loading scope. It cannot be
relabeled as independently covered current warm walkthrough evidence. These are
separate missing facts; saved-only scoring cannot make the full gate pass.
