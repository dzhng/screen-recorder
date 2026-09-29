# 15a2d — Linked mono state execution

Status: verified initial mono/structural-dual-mono runtime; [retained evidence](../assets/15a2d-linked-runtime/README.md). Extends [15a2c](15a2c-state-input-bindings.md) through the existing native composition and prepared-audio owners. Dependencies: [15a2c](15a2c-state-input-bindings.md). The complete [15a2](15a2-denoise-prepared-consumers.md) and [15a](15a-noise-processing.md) requirements remain open.

The compiler lowers one selected prerequisite forest. Each state component refers to its member's current ordered prefix and exact sample interval; it does not carry a copied graph. Native execution consumes the compiler's dependencies, opens source bindings once, and uses the ordinary mixer for prefix views and final output. Replaced upstream branches are pruned. A resumed decoder cursor repositions through the existing retained-run resampling policy.

One render attempt owns a reusable mono input file and an append-only processed PCM spool. A component becomes readable only after its complete prefix, fixed adapter call and exact output count succeed. The adapter is called once per connected component, including continuity across split members with different prefixes. Zero-sample components perform no inference. Requested output ranges select prepared spans; they never establish a new DSP origin. Every state boundary splits native blocks before downstream processing.

The fixed model is linked directly into the native audio target. Explicit local preparation verifies the frozen archive, vendored source and generated model bytes; the app build verifies preparation before invoking Swift and copies the source notice/provenance. No edit, preparation job or read downloads or converts weights. External model redistribution remains unresolved as described by the parent contract.

A bounded startup metadata query binds the observed native recipe identity to audio and movie execution. Missing capability leaves new RNNoise preparation unavailable. Existing prepared PCM can still be read without executing RNNoise or satisfying its current availability requirement. This is a consumer independence claim within the linked-binary test, not a model-absent binary claim.

Produced execution requires actual mono source format matching stored provenance and complete selected readable support. Authored silence and equal-channel gain/mixing preserve structural dual mono, which is checked before inference. Declared stereo, unknown format, changed physical format and missing support refuse. General stereo processing is not enabled.

The linked and public harnesses in `packages/test-harness/editing/denoise-runtime*.mjs` own replay. Complete frozen PCM comparisons are numerical preservation evidence only. The user's unfamiliar random-word excerpt feedback established no obvious artifacts, not intelligibility or word retention. Any later human audition must use complete meaningful sentences from their recording, with the original alongside and one clear question; this checkpoint requests no audition.

Remaining parent gates include the full independent-channel policy, broader prepared portability/consumer acceptance, and protected-speech/listening judgment. Neither matched PCM nor a successful linked build closes them.
