# 12d — Complete sentence cleanup annotation packet

Status: bounded native packet and machine preservation checks passed; independent
word-boundary labels remain open. The user accepted neighboring speech and the
join as clear and natural on 2026-09-29. Dependencies: [12](12-speech-evidence.md).
[Evidence and reproduction](../assets/12d-complete-sentence/README.md).

## Contract

Give an external agent a comprehensible original and explicit filler-cut candidate
with all proposed w111–w123 context. Preserve the failed short-context packet.
Keep inherited ASR text, manually marked filler bounds and missing independent
annotations distinct. No model selection, new models, public cleanup API, or
subjective acceptance follows from sample equality.

## Verification

- [x] Complete proposed sentence and readable original/candidate transcript.
- [x] Frozen source/native identities, exact source/output mapping and frame counts.
- [x] Retained PCM equality outside the native join ramps; mutation control fails.
- [x] Actual source poison changes original only in removed frames, while the full
  candidate PCM is unchanged through the real native excerpt owner.
- [x] Original source and earlier partial packet preserved; no playback or model use.
- [x] User candidate join judgment: “Yes, clear and natural.”
- [ ] Independent audible sentence/neighbor boundary labels.
- [ ] Parent slice 12 complete filler/repetition inventory and timing acceptance.

The outer 250 ms guards are explicit presentation context based on inherited ASR,
not new word boundaries. Only the inherited filler interval is removed. Repeated
phrases are excluded because accidental versus deliberate repetition is not
independently established. Root owns the parent handoff and choices ledger.

Review: shape/diff/docs checks retained one native excerpt owner and one focused
fixed-corpus harness; no production abstraction or dependency added. Formatter
and lint passed. Independent Codex review found no actionable defect and verified
artifact hashes; its attempted native rerun was blocked by its sandbox. The
recorded native pass ran separately in the permitted environment.
