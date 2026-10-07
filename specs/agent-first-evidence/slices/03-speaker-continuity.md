# 03 — long-form speaker continuity

## Contract

Add a continuity evidence generation around the existing bounded `speaker`
provider. Preserve independent 80 ms-grid windows, anonymous slots, overlap and
unknown intervals, complete transport receipts, and fresh state boundaries.
Only promote a longer envelope after the frozen gates pass; otherwise publish a
truthful refusal with complete operands and metrics.

Continuity never creates human names. `speaker.bind` remains caller-authored,
and transcript attribution remains generation-pinned with `unknown`/`overlap`
when coverage is incomplete.

## Ownership and seam

Extend the existing speaker Core/service/model registry/package owners and the
shared CLI/MCP handler. Reuse `speaker.prepare/get`, job retry, generation,
package, and transcript projection contracts. Do not fork a second diarization
API or loosen the existing 30-second public provider bounds until a candidate
passes the long gate.

## Verification

Run short state/reset and return/silence controls first. Then verify complete
600-second transport, three-speaker continuity, and mandatory four-speaker
simultaneous speech. Keep DER ≤20%, identity confusion ≤5%, overlap recall ≥80%,
count/resource gates unchanged. Replay the retained failed four-speaker result
(57.49% overlap recall) and threshold frontier as refusal evidence. Add changed
model, truncated input, reused-state, missing-score, and edited-metric mutation
checks.

## Must stay green

All existing speaker, transcript attribution, package, model-preparation, and
long-input envelope replays; no live-device or human-listening check is required.
