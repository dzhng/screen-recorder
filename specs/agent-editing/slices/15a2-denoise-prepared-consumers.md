# 15a2 — Typed learned state and prepared consumers

Status: [pure clip state-domain checkpoint](./15a2a-state-domains.md) verified; [parent/window checkpoint](./15a2b-parent-state-windows.md) verified; [input-binding checkpoint](./15a2c-state-input-bindings.md) verified; [linked mono runtime checkpoint](./15a2d-linked-denoise-runtime.md) is verified for mono/structural dual mono. Parent: [15a](./15a-noise-processing.md). Dependencies: [15a1](./15a1-denoise-entry-parity.md), [14a](./14a-prepared-audio.md), accepted state/channel contract from [12c](./12c-noise-reproduction.md).

The first checkpoint owns explicit clip membership and edit/compiler meaning. Parent track/group/output domains will span first through last structural retained audio contributions, including authored silence/internal known gaps; never find boundaries by amplitude. Connected authored active windows select DSP input with no outside-window context. Source missing-support diagnostics remain authoritative. Independent channel state is the intended full policy, but initial runtime proof is mono/structural dual mono until real stereo gates pass; input provenance and initial produced-state admission are owned by the input-binding checkpoint.

Define supported target/channel/state domains explicitly; retained proof is full selected mono output, not general stereo/clip/track/group/window semantics. Current 14a output is stereo. Do not invent downmix, independent-channel behavior, resets, strength or transitions as plumbing. Unsupported intent refuses explicitly.

Add the typed recipe to the existing composition registry/compiler, pinned model/adapter identity and availability requirements; bind the same native adapter in the audio graph. Prepare the actual upstream signal at its ordered stack position through PreparedAudioStore/JobQueue/AssetStore/ResourceReferences. Preview/export/taps must read the correct retained domain without restarting DSP at a requested range. Preserve downstream order and raw source reads. Explicit model preparation and distribution/build readiness belong here; never download implicitly during an edit.

Verify real gain-before/after noncommutation, dry bypass, split/trim/poison isolation, exact duration/latency and bounded range/full equality, historical revision identities and model-free retained reads. Add only model-specific joins to existing cancellation/retry/restart/fencing/portability tests; no second store or queue. Verify public authoring/discovery/refusal and prepared inspection through CLI/MCP. Runtime scope must remain discoverably constrained until the complete [15a3](./15a3-denoise-acceptance.md) and parent contract is verified.

Next pickup: extend supported-channel and temporal/retained-consumer gates from the linked mono checkpoint in 15a2d; preserve the fixed adapter and existing prepared owner. Include state prerequisites outside requested output in file bindings, missing-support checks and resource retention. Do not infer mono or structural dual mono from the existing stereo prepared output format. Explicit model preparation is a build prerequisite, with no runtime download or implicit model conversion. The complete parent requirements above remain open.

[Selected-input and ordered-tap isolation](15a2e-state-isolation.md) extends the initial mono runtime checks. Independent-channel execution and complete parent acceptance remain open.

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
