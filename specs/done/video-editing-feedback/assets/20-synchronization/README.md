# Waveform synchronization research — refused

The [frozen protocol](protocol.json) preceded real comparisons. Complete selected
channel windows use the existing native decoder; no recognition, forced text or
model inference was performed. [Original acquisition](acquisition.json) pins the
external originals, exact selections, native binary and raw PCM receipts.
[Original comparisons](original-comparisons.json) preserve every anchor's competing
peaks, coverage and parameter interpretation. All nine source-pair/windows were
unsuitable. The strongest observed absolute correlation was about0.197, below
0.35; selected offsets did not establish one common clock. Thresholds were not
tuned after this result. Duration equality and session provenance were not used
as synchronization evidence.

[Retained WAV inputs](../../../../../fixtures/video-editing-feedback/synchronization/README.md)
wrap the captured Float32 bytes without resampling or attenuation. Actual native
re-decode reproduces every captured PCM hash, retained in
[the replay receipt](retained-replay.json). [Retained comparisons](retained-comparisons.json)
match all original numerical results exactly, excluding elapsed time. This
preservation proof says nothing about lexical or speaker truth. The fixture set
adds roughly11.5MB of lossless WAV through existing LFS ownership.
The [real replay receipt](real-replay.json) now makes that nine-comparison
refusal executable without rerunning inference.

[Controls](controls.json) cover independently authored known delays, gains,
polarity, noise, silence, unrelated and periodic audio, one gated anchor,
out-of-search offsets and discontinuous piecewise drift. Signed mapping and
missing-anchor mutations genuinely failed their focused tests, then the restored
candidate passed. The existing immutable alignment runtime supplied NumPy/SciPy;
no dependency or inference work was repeated for this numerical experiment.

The bounded [receipt adapter](../../../../../packages/test-harness/editing/synchronization/receipt.py)
now turns a measured constant-offset control into source-bound accepted evidence
with a deterministic fingerprint. Its focused controls cover estimator-to-receipt
admission, duplicate-source refusal and anchor-spread refusal. This is an
admission contract only: none of the nine real unlike-microphone comparisons
produced an accepted receipt. The [focused receipt verification](receipt-verification.json)
retains the command, source hashes, control shape and explicit real-corpus limit.

The waveform hypothesis is refused for these unlike microphone inputs. Slice20
remains open. The next frozen hypothesis is lexical anchors from independently
recognized shared content plus accepted10B alignment evidence. Supplied text alone
cannot manufacture a shared utterance. Slice21 now implements caller-declared angle relationships; accepted synchronization
evidence and switched-view delivery remain open. There is no automatic retime, angle
selection or provider promotion.
The [initial independent review](independent-review.md) found missing pre-work
bounds and absent executable comparison against frozen receipts. All three
regressions failed before their fixes, then passed through the outer CLI; the
corrective prepared-runtime review now passes the offset, receipt and research
suites.
[Exact replay](exact-replay.json) now pins the reference hash and compares every
field except elapsed time. Candidate comparisons remain available on refusal.
Acquisition and optional native replay refuse invalid envelopes before native work.

[The independent lexical scout](lexical/README.md) also refuses its prerequisites
on the same retained windows: independently recognized sources share no candidate
utterance across any selected windows. No timing inference or synchronization
promotion follows that failure. This bounded scout does not rule out shared content elsewhere in the originals.

The [full-domain lexical scout](full-domain-lexical/report.json) extends that
question to 381 non-overlapping 20-second windows (with one-second gaps) across
the four authorized source domains: Graham, Lily part one, Lily part two and
Madison. Its pinned Parakeet transcript fixtures contain 6,536 normalized words.
There are no cross-participant exact five-word anchors; the longest such n-gram is
four words. The only repeated five-word phrase is between Lily's two split files,
with incompatible offsets, so it cannot establish a shared session clock. The
[inference-free replay](../../../../../packages/test-harness/editing/synchronization/full-domain-lexical-replay.mjs)
checks the protocol, source identities, compressed and raw transcript hashes and
the refusal fields. This closes the selected full-domain lexical search as a
refused hypothesis; it does not rule out a different shared-content or physical
clock hypothesis elsewhere, and it does not admit synchronization.
[Mixed-reference bridge research](bridge/README.md) now retains separately frozen
local observations while preserving all original acoustic, lexical and global-clock
refusals. Slice20 remains open; local sampled bridges do not declare a session clock.
