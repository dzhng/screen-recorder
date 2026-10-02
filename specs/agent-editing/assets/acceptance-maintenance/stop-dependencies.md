# Camera publication dependency audit

Read-only source audit at its original baseline after MCP media integration.
The later [20f implementation](../../slices/20f-camera-publication-overlap.md)
adds scoped scheduling preservation and a genuine qualified interrupted-prefix
case. The [retained metadata predicate](../20f-camera-publication-overlap/retained-eligibility/README.md)
passes without publication; actual full-take overlap, resources and performance
adoption remain open.
This audit itself performed no build or runtime measurement. The ten-second completed-stop requirement remains
failed; this is a prospective scheduling seam, not an accepted optimization.

The [publication owner](../../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift)
at that baseline scans raw pictures, exports their physically established support, then
scans the canonical candidate. Each digest includes exact ordered timestamps,
dimensions and every visible BGRA byte. Preserve that representation and the
[existing component measurements](../20e-camera-digest-components/README.md).
Independent per-frame hashes would change the digest; buffering the whole raw
picture stream would require an excessive working set.

There is a different possible dependency break. Retained observations own the
accepted picture mappings. The closure marker binds completed writer bytes but
does not prove physical decoding. A streamed mapping and occupied native sample
inventory could establish an **intended** support interval before either BGRA
scan. The [native sample timing owner](../../../../helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift)
already supplies the last sample's end to the existing picture reader. Use the
first mapped start and the lesser of the final mapped nominal end and native
mapped sample end; asset duration, callback cadence and journal completion cannot
substitute for these facts.

For a narrowly qualified closed case, private passthrough export could precede
two concurrent complete scans, each retaining its own existing sequential digest.
Working memory would hold the two reader pipelines and bounded mapping buffers,
not all pictures or an array of frame hashes. Actual decoder-pool memory remains
unmeasured. Qualification is not physical acceptance: both complete scans must
settle before a receipt or public file can be committed.

## Preconditions and failure ownership

Qualification would require matching closure/input identities, complete untorn
mapping, exact increasing mapped timestamps, complete occupied native inventory
with matching count/order, and representable intended support. Unsupported layouts
and uncertain or malformed qualification return to the current raw-first path;
caller cancellation propagates. Raising a later mapping error during qualification
could otherwise hide an earlier raw timestamp error.

Actual raw count, support and diagnostics must agree with qualification before the
speculative canonical candidate can be used. A short physical prefix, premature
completed EOF or late decoder failure retains the existing prefix path and its
diagnostics. The intended full interval must never become the receipt for an
actually shorter decode. Raw validation owns error precedence; the first task to
throw cannot select the public outcome.

Any prospective implementation must preserve these complete outcomes:

- Native holds, fractional terminal clipping, picture order and full digest.
- Missing accepted pictures, premature EOF, `acceptedBeyondPhysicalEOF`, usable
  interrupted prefixes and `rawDecodeInterrupted`.
- Unmapped tails, torn mappings, interior timestamp mismatches and malformed
  later rows, including raw-first refusal precedence.
- Changed raw/observation/mapping/marker/journal identities, canonical pixel/count/
  timestamp/support mismatch, cancellation, conflict and recovery continuation.
- Closed-source lifetime and a single terminal append, with no public replacement
  or receipt from a speculative failed candidate.

## Evidence needed before adoption

First prove the complete compact preservation matrix against the current owner,
including fault ordering and generic partial-prefix fallback. Only a materially
changed candidate that earns those checks justifies another bounded retained-file
publication measurement. Keep the frozen worker and accepted cohort unchanged.
Record actual peak memory and every published picture/support/digest value; do
not turn a prefix or estimated ideal overlap into full-stop evidence.

Both scans still process approximately 73.455 GB of visible pixels on the retained
take. The saved roughly 10.8-second digest time per stream means ideal overlap
alone does not establish the ten-second stop target. Additional work remains even
if scheduling parity is proved. No production strategy is selected by this audit.
