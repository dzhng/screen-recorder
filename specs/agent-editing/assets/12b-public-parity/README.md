# Controlled public speech parity

The [report](report.json) records actual CLI/MCP/service ingestion, queries,
explicit fixture edits, audio delivery, restart and generation fencing with
retained ASR responses. Model readiness is declared by a fixture; native media
admission and audio rendering use the unchanged isolated worker. This proves the
public integration contracts exercised here, not fresh recognition, preparation
integrity, timing quality or listening acceptance.

Raw engine bytes, recognized text, confidence, source ranges and engine pins
survive ingestion unchanged. The fixture places two occurrences of one retained
excerpt and explicitly removes one interval from one occurrence. Complete
14-second PCM changes only inside that supplied interval; the other occurrence,
source, historical output and undo remain exact. No removal is selected by the
engine and no personal keep/remove judgment is needed.

A simulated decoder-identity change uses the real queue and ingestion owner.
Old transcript and phrase cursors refuse both before and after replacement
publication, new reads retain the same words, and old raw evidence remains
inspectable. The [verification](verification.json) binds initial and replacement
requests/receipts, retained media and source/runtime identities. The
[media archive](media.tar.xz) contains the fixture and full delivered outputs;
[failed checks](failures) preserve the stale recipe literal, property-order
comparison and early harness wiring failures before correction.

The public preparation states are controlled inputs, not actual model jobs.
The recorded earlier Parakeet directories were checked and are absent. No model
was downloaded, installed, prepared or executed. Current native request/decoder
parity still needs matching actual inference evidence before parent 12b closes.
The selected best-effort baseline and its recorded quality misses remain intact;
no alternate recipe or general acoustic-cut guarantee is adopted.

Run the [probe](../../../../packages/test-harness/editing/speech-parity.mjs) with
the isolated worker, retained baseline reference and a fresh output directory.
It does not invoke the consumer skill or play audio. Shared declared-model
fixtures and simulated generation checks have one owner each, also used by the
existing query journeys.
