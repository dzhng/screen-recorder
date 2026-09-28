# Imported capture termination provenance

An imported acquisition retains recorded facts, not a guessed outcome. The existing
`finished` flag says a finished record was present. `lastLifecycle` retains the
last reported state and reason, but that transition has no timestamp. Optional
`completion` retains the valid finished record's sequence, terminal state, duration
and actual failure code. Its duration is the finalized capture/video source
endpoint after pause removal and finalization; it is not failure-onset time or the
end of whichever audio stream a caller selected.

The journal reader owns this interpretation for inspection and normalized export.
Presence-only finished payloads from existing inputs remain valid without gaining
a timed completion. Invalid supplied terminal fields stop at the trustworthy
prefix; torn/corrupt later bytes neither erase an earlier recorded completion nor
invent one. Normalized cursor, pause, geometry and acquired-audio rows are unchanged.
The receipt shares the existing bounded provenance budget; over-budget provenance
refuses publication without truncating fields or altering the original journal.

The core receipt validator admits those optional facts for both recording and
acquisition owners. Acquisition adoption retains the receipt directly; no new
ledger, fabricated recording row or selected-stream timestamp inference is needed.
Existing portable/recording readers continue to accept receipts without these
fields. No source/project interruption rows or public protocol routes change here.
Their next pass must map the explicit capture endpoint through the selected
binding's capture-to-asset offset and the composition endpoint projection.

## Verification

The native worker checks complete/interrupted records, absent and presence-only
completion, malformed fields, torn/corrupt prefixes and bounded refusal. Generated
samples through the actual CaptureWriter produce both complete and interrupted
results; exported completion matches the writer's state, duration, failure code
and exact journal sequence. This does not claim a physical device interruption.

`normalized-parity.json` pins old/new native binaries and byte-identical normalized
output for twenty thousand cursor samples and twenty thousand separated audio
intervals. `native-adoption.json` records actual native export and probe followed by
core acquisition import, donor removal and catalog reopening. These are synthetic
journals around real media and the actual core importer, not CLI/MCP acceptance.
The focused tests also retain bounded-memory streaming, recording event semantics,
portable evidence, package admission and processing behavior.

The frozen prior worker fails the missing-provenance assertion. Removing core
completion validation makes malformed provenance publish and fails the regression.
Those red controls are retained beside passing evidence. Shape review keeps the
compact facts in the existing journal/receipt owners; no normalized row or index
format changed.

Independent review found no actionable defects and reproduced the core preservation
and ordinary native worker checks. Its sandbox blocked RSS sampling and generated
writer fixture initialization; the separate unsandboxed native/writer evidence
above supplies those proofs. No physical capture or public interruption delivery
claim follows from this prerequisite.
