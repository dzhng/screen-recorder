# 15a2 — Typed learned state and prepared consumers

Status: [pure clip state-domain checkpoint](./15a2a-state-domains.md) verified; [parent/window checkpoint](./15a2b-parent-state-windows.md) verified; [input-binding checkpoint](./15a2c-state-input-bindings.md) verified; [linked mono runtime checkpoint](./15a2d-linked-denoise-runtime.md) is verified for mono/structural dual mono. Parent: [15a](./15a-noise-processing.md). Dependencies: [15a1](./15a1-denoise-entry-parity.md), [14a](./14a-prepared-audio.md), accepted state/channel contract from [12c](./12c-noise-reproduction.md).

Clip continuity, current retained-input domains, parent/window selection, native binding and independent mono/stereo lane execution are verified by the linked checkpoints. Parent track/group/output domains span first through last structural retained contributions, including authored silence and internal known gaps; boundaries do not depend on amplitude. Connected authored active windows select DSP input. Existing source conversion retains its own upstream context contract, and missing-support diagnostics remain authoritative.

The fixed channel policy uses independent state per mixed output lane, without downmix, linking, normalization or sampled mono detection. Unknown and more-than-two-channel sources refuse. This scoped numerical policy is not protected-speech or spatial listening acceptance. Retained prepared output remains readable when current learned preparation operations are unavailable; this does not imply a model-absent binary or absence of native source decoding.

Add the typed recipe to the existing composition registry/compiler, pinned model/adapter identity and availability requirements; bind the same native adapter in the audio graph. Prepare the actual upstream signal at its ordered stack position through PreparedAudioStore/JobQueue/AssetStore/ResourceReferences. Preview/export/taps must read the correct retained domain without restarting DSP at a requested range. Preserve downstream order and raw source reads. Explicit model preparation and distribution/build readiness belong here; never download implicitly during an edit.

Verify real gain-before/after noncommutation, dry bypass, split/trim/poison isolation, exact duration/latency and bounded range/full equality, historical revision identities and model-free retained reads. Add only model-specific joins to existing cancellation/retry/restart/fencing/portability tests; no second store or queue. Verify public authoring/discovery/refusal and prepared inspection through CLI/MCP. Runtime scope must remain discoverably constrained until the complete [15a3](./15a3-denoise-acceptance.md) and parent contract is verified.

The [unit-rate combined public join](15a3a-unit-rate-combined.md) is verified, preserving the fixed adapter and existing prepared owner. Next pickup is dependency-ready remaining15a3 acceptance. Channel, portable transfer and [successful long-output](24f-successful-learned-scale.md) gates are already scoped passes, not repeated prerequisites. Post-retime execution, broader encoded/perceptual acceptance and the complete parent requirements remain open. Explicit model preparation remains a build prerequisite with no runtime download or implicit model conversion.

[Selected-input and ordered-tap isolation](15a2e-state-isolation.md) extends the initial mono runtime checks. [Independent-channel execution](15a2f-independent-channels.md) and [learned portable preservation](../assets/14a-learned-portable/README.md) pass their scoped numerical/public gates. Complete parent acceptance remains open.

## Native build adoption

Use the frozen compiled model directly in the existing worker. Explicit developer
and release preparation verifies the local archive and generated source before
building; the normal app build entry point must report a missing preparation
prerequisite clearly. The isolated checkpoint's dependency-free app build is not
a permanent optional-feature requirement. Do not add plugin selection or convert
weights solely to preserve that temporary arrangement. Worker capability and
recipe identity must describe the model actually compiled into that worker.
Preserve direct-entry byte parity before public runtime adoption.

The [pinned upstream notice](https://raw.githubusercontent.com/xiph/rnnoise/70f1d256acd4b34a572f999a05c87bf00b67730d/COPYING)
must accompany binary distribution. The verified model archive contains generated
C/headers and training checkpoints, without a separate license file. Its hash
still matches `helpers/denoise/provenance.json`. The
[pinned README](https://raw.githubusercontent.com/xiph/rnnoise/70f1d256acd4b34a572f999a05c87bf00b67730d/README)
describes model downloads but does not explicitly resolve their license. An
[open upstream request](https://github.com/xiph/rnnoise/issues/284) asks for that
clarification as of2026-09-28; it is not a maintainer grant. Continue local personal
integration and retain notices; external model redistribution acceptance remains
unverified. No upstream contact or new download was performed for this check.
