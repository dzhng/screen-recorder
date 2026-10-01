# Speech evidence and editorial authority

Read-only implementation audit from `5343aec492e757352cd05e26d67c895864594cae`,
against the [editorial-control contract](../../architecture.md#editorial-control).
No concrete detector-driven edit or recognized-word filtering was found in the
audited managed-project speech → evidence → edit closure. This is a bounded source
finding, not a new runtime or acceptance gate. The
[source pins](editorial-boundary-source-pins.json) own the exact consumer list,
hashes and inspected-checkout parity.

Native transcription retains the raw recognizer result and every grouped word.
Grouping adjusts punctuation/overlap timing without choosing unwanted words.
Ingestion retains each validated raw word's text, ordinal and confidence and adds
the fixed speech/filler/vocalization classification; malformed evidence is refused
rather than silently filtered. Recognition misses and visibly skipped too-short
intervals are evidence-quality limits, not permission to edit.

Source, recording, portable and project reads project the caller's support,
authored clips and query window. Literal search folding and gap/partial-word phrase
barriers affect matches, while the underlying word rows remain available. Neither
classification nor phrase search enters project mutation. Transcript cleanup
reclaims unretained generations/artifacts, with retained references protected; it
does not choose speech spans to remove.

Within the speech/evidence-to-edit flow, authored changes enter through explicit
edit requests or caller-authored text cues. Text seeding uses pinned words and caller-supplied grouping,
separator, style and anchor. Remove/trim partition requested ranges and apply the
requested ripple scope. Mechanical defaults fill parameters of requested
operations; they do not add fades, denoising, room tone or replacement speech.
State normalization preserves already authored processing. Composition audio sums
unity inputs and applies enabled authored processing, without classification-driven
normalization, ducking or treatment selection.

The retained recording PCM route has a separate, non-neutral compatibility
contract: fixed 5ms internal join ramps, clamped to half a span, and gain 1 or 0.5
according to the planned source count. That documented legacy behavior is not a
filler/repetition detector choosing edits, and the current managed composition
route does not inherit it. It must not be hidden inside this scoped clean finding
or used to imply global neutral output. Installed switching, deletion and migration
of the preserved legacy policy remain outside this audit.

Local shape/diff/docs review checked the evidence-versus-mutation ownership,
classification-only terminology and the explicit compatibility qualification.
No product code, hook, policy, tests, model, service, capture, media or UI work ran.
Speech quality, raw recognizer recall, physical capture and runtime output remain
unverified by source inspection; no broader repository claim is made.
