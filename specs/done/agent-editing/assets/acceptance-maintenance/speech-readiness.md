# Speech implementation and missing release evidence

The unchanged selected baseline already has its public implementation proof in
[12b](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/12b-speech-processing.md). Another recognition or alignment
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
[shared evaluator](../../../../../packages/test-harness/speech/evaluate.mjs) can score
existing predictions. Missing reference data remains a fact, not another model
trial or an automatic assignment to the user.

Bounded publisher-document qualification found no execution-ready replacement.
[Buckeye](https://buckeyecorpus.osu.edu/php/corpusTran.php) has trained human
word/phone corrections and preserves fillers/restarts, but its
[license](https://buckeyecorpus.osu.edu/License.pdf) limits research/educational use
and restricts commercial product use. Research use by a licensed user is
allowed in principle, but the publisher requires a signed/submitted agreement
and registered, email-activated access; that authority is unestablished here. [Switchboard](https://catalog.ldc.upenn.edu/LDC97S62)
has a [commercial licensing route](https://catalog.ldc.upenn.edu/license/ldc-for-profit-membership.pdf)
and [corrected alignments](https://isip.piconepress.com/projects/switchboard/),
but applicable access is unestablished. Its
[annotation report](https://isip.piconepress.com/projects/switchboard/doc/reports/1998/report_081598_v1.pdf)
describes correction of gross errors rather than precise adjustment of every
connected-word edge. [CHP/CCHP](https://filledpause.org/chp/cchp/readme/) has
noncommercial terms and timing coverage limited to fillers and their immediate
contexts. None was downloaded or run. Qualification must establish applicable
use, complete independently reviewed intervals and required category counts
before inference; a corpus name alone supplies none of those proofs.

[AMI](https://groups.inf.ed.ac.uk/ami/download/) permits development/evaluation
under CC BY 4.0 and supplies human-checked transcripts with disfluencies. Its
[transcription procedure](https://groups.inf.ed.ac.uk/ami/corpus/transcription.shtml)
states that word and phoneme times come from automatic forced alignment; human
review covered transcript completeness and speech-segment boundaries. It is
license-qualified lexical material, not independently reviewed word-edge truth.
The [frozen lexical selection](../12-ami-lexical-reference/README.md) now retains
complete human-checked word references and original annotation inputs. No audio
was acquired and no model was run. Its automatic word times remain locators only;
this preparation does not supply the missing independent acoustic reference.

[The bounded access qualification](speech-reference-access.json) retains the
additional L2-ARCTIC findings. Its scripted source was curated to remove
repetitions/false starts, so more read-sentence examples cannot supply the missing
disfluent reference. The separate spontaneous suitcase subset has promising
manual review, but exact filler/neighbor coverage is unverified and no directly
linked small annotation-only artifact was available. Publisher access requires
a form and emailed link. No form, account, contact or license submission occurred.
Do not repeat generic corpus qualification or inference against automatic times;
independent reference acquisition currently needs an established access route.

The [accepted explicit cut](../12e-labeled-cleanup/README.md) already preserves its
marked protected words, original PCM and undo; its listening verdict applies to
that candidate. Broader protected ranges and new joins need independent references
and actual listening evidence. Numerical clocks or exact PCM cannot provide it.

The full evaluator also requires its canonical/held-out, silence, technical-name,
audition and qualifying warm-walkthrough coverage. The
[historical resource evidence](../../../../recording-for-ai/assets/speech/boundaries/README.md)
retains its actual concatenated narration and model-loading scope. It cannot be
relabeled as independently covered current warm walkthrough evidence. These are
separate missing facts; saved-only scoring cannot make the full gate pass.
