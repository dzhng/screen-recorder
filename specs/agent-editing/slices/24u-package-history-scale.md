# 24u — Combined document and retained-history package scale

Status: complete within the measured fixture; retained failure and final proof in
[the evidence](../assets/24u-package-history-scale/README.md). Dependencies:
[22](22-portable-projects.md), [24r](24r-history-query-scale.md).

Exercise the public package boundary with 1,000 real ProjectStore revisions:
one empty creation and 999 documents each containing 250 clips reusing one small
source. Preserve the complete ordered history, document meaning and undo stack.
No original historical metadata is reconstructed or inserted directly.

A five-revision owner preflight projects 101,522,148 UTF-8 history/resource bytes,
a 338,587-byte manifest and 999 dependency edges. The actual fixture must measure
its serialized bytes against the unchanged per-revision, manifest, aggregate,
member and dependency limits before transfer. Record actual peak/sampled RSS;
4 GiB is an operational stop guard, not a package-serialization performance SLA.

Use actual export/open/adopt operations. Advance the donor to its 1,001st revision
and require explicit history-limit refusal without truncation or an output file;
a package pinned to the prior revision must still preserve every selected member.
Compare complete inventory hashes and all adopted revision/document identities,
normalizing only independently reassigned project/revision IDs. Read historical
revisions and exercise the retained undo stack. Render a bounded audio selection
before and after transfer with the donor paths unavailable; never render a full
long project merely for this gate.

Keep failures, exact requests, source/metadata hashes and memory observations.
Do not relax package budgets, copy models, repeat learned DSP or infer broader
history/composition cross-product support from this fixture. Root owns hub and
choices integration.

The measured failure belonged to repeated project-head publication during history
insertion. Keep insertion separate from selecting the visible head; adoption
already selects its final head in the same transaction. Preserve exact canonical
request equality and atomic dependency/history/undo publication. The complete
mapped undo inventory and one actual latest undo are proven, not every possible
undo sequence. No broader responsiveness or memory SLA follows from this pass.
