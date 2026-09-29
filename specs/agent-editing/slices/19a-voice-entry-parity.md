# 19a — Frozen voice worker entry parity

Status: planned. Parent: [19](19-voice-assets.md). Dependencies: [18a](18a-voice-repeatability.md), the frozen main reference-conditioned candidate from [18](18-voice-reproduction.md), not its unresolved listening verdict.

## Contract and owner

A private production-intended worker preserves the frozen candidate's complete
output for matched requests. As with [15a1](15a1-denoise-entry-parity.md), this
entry checkpoint does not enable public discovery or satisfy the parent quality,
reference-origin or durable-generation contract. The rejected speaker-only mode
is not an alternative implementation. Keep the model, runtime, generation
configuration, reference handling and Float32 WAV assembly unchanged.

Use one explicitly prepared Python process accepting one bounded JSON request
and returning one result after its WAV is complete. Reuse the service's existing
JSON framing, process deadline, cancellation and close-before-release owner.
If needed, extract that process primitive once and have both native and voice
bindings use it. Preserve native-worker behavior and existing tests. Do not add
a resident model daemon, shell command strings, another queue or a second
process-lifecycle implementation.

The preparation boundary supplies absolute executable/entry/model paths and
verified runtime/model identities explicitly. Refuse missing or mismatched
preparation before inference. No `/tmp` discovery, implicit install/download or
model conversion. Preserve offline flags and OS network denial. The current
ASR-specific SpeechModels owner is not a general voice registry; this private
checkpoint consumes a minimal explicit preparation receipt without adding a
parallel catalog or user-facing model-preparation endpoint.

The request supplies the retained reference WAV, reference transcript, desired
text, effective generation parameters and seed, plus caller-owned output staging.
Return actual duration/format, complete output identity and effective
request/reference/runtime/model provenance. Bound request/reference sizes and
retain the frozen reference-loading behavior. Do not select voices, normalize,
trim, stretch, splice, add room tone or mutate any project.

## Verification

Run both fixed texts through the real shared launcher in fresh processes.
Compare every Float32 sample, format/count and complete WAV with the frozen18
outputs and18a. Hash mismatches remain failures: no new tolerance, seed tuning
or replacement baseline. Record model/runtime/request/reference identities and
distinguish fresh processes from cold system caches.

Missing/wrong preparation and malformed or unsupported reference inputs must
refuse without publishing audio. Existing output/staging ownership must remove
partial files after real cancellation, deadline, malformed response and worker
failure; never overwrite input or a pre-existing destination. Prove the process
and pipes are closed before releasing capacity. Keep the existing native-worker
framing, refusal and cancellation gates green after any shared extraction.

No public `voice.generate`, asset/job kind, catalog migration, managed reference
origin, enrollment or editing UI is introduced here. Later19 integration owns
durable references, publication/replay and ordinary placement. Listening and
protected-context acceptance stay open in18/19, regardless of byte parity.

Private implementation names and process packaging are delegated within these
constraints. Any broader model-registry or public API choice needs a separate
slice before implementation. Root owns hub, evidence and choices integration.
