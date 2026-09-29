# 19d1 — Nonempty probability-filter support

Status: complete within the registered measured profile. [Adoption evidence](../assets/19d-voice-adoption/README.md) verifies runtime adoption, exact audio parity and unchanged lifecycle gates. Parent: [19d](19d-voice-settings.md). Dependencies: [19b](19b-voice-runtime-relocation.md).
[Experiment and candidate](../assets/19d1-probability-filter/README.md).

## Contract and ownership

Repair the pinned Qwen probability-filter helper without changing the model,
precision, settings envelope or existing nonempty filtered distributions. Keep the
exact default early return. The registered backend remains the sampler owner;
the experiment substitutes only that helper in a fresh numeric process. It is
not a second generation implementation or an installed runtime change.

Valid helper input has at least one finite logit in each row; every other entry
is finite or a legitimate negative-infinity mask. If the existing helper empties
a valid row, restore its first maximum-logit candidate. This deterministic tie
policy applies only to previously empty results. Preserve dtype, shape, original
finite values, existing masks and RNG state. Do not introduce device-to-host
synchronization in the sampling loop.

NaN, positive infinity and all-masked input are ineligible for repair. Leave their
existing invalid result unchanged and report the input precondition explicitly;
this experiment does not implement runtime refusal. Arbitrary invalid logits from
a model remain outside the nonempty-support guarantee. Existing generated-output
validation stays with the worker. No claim of ideal nucleus probability mass is
made for the pinned low-precision calculation.

## Verification and next gate

- [x] Preserve all original numeric reds and reproduce their classifications.
- [x] First3072/residual2048 vocabulary controls, smallest positive binary64 top-p,
  uniform populations, suppression/repetition/temperature interactions.
- [x] Existing valid results: exact post-transform logits, tokens, dtype/shape and
  RNG state. Repair every inherited empty result to a finite positive normalized
  distribution; a sampled token alone is not proof.
- [x] Masked/invalid inputs, tied maxima, float32/float16/bfloat16 and batched helper
  shapes. Batched speech generation remains outside this slice.
- [x] Exact default bypass and bounded timing through the existing sampler.
- [x] Review and adopt the source patch under a new immutable runtime/entry
  identity. Coordinate with 19d; never retarget its existing measured artifact.
- [x] Actual managed-worker default word/phrase full WAV and PCM parity, plus an
  already-valid filtered request/replay and formerly failing filter control.
- [x] Preserve lifecycle, preparation deadline and parent settings gates without
  changing limits or attributing earlier failures to unmeasured host conditions.

The initial experiment performed no model load or synthesis. The subsequent
19d adoption verifies the real registered path under its new immutable identity;
19f owns public durable jobs. Parent voice quality and listening remain separate.

Review: root and independent Codex review found no actionable defect. The latter
checked the submitted files and recorded hashes without rerunning MLX. Shape,
diff and documentation review kept the experiment outside the runtime owner;
the recorded numeric run exited successfully under OS network denial.
