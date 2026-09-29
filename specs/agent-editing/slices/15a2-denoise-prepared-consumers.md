# 15a2 — Typed learned state and prepared consumers

Status: not started; policy must be specified before public execution. Parent: [15a](./15a-noise-processing.md). Dependencies: [15a1](./15a1-denoise-entry-parity.md), [14a](./14a-prepared-audio.md), accepted state/channel contract from [12c](./12c-noise-reproduction.md).

Define supported target/channel/state domains explicitly; retained proof is full selected mono output, not general stereo/clip/track/group/window semantics. Current 14a output is stereo. Do not invent downmix, independent-channel behavior, resets, strength or transitions as plumbing. Unsupported intent refuses explicitly.

Add the typed recipe to the existing composition registry/compiler, pinned model/adapter identity and availability requirements; bind the same native adapter in the audio graph. Prepare the actual upstream signal at its ordered stack position through PreparedAudioStore/JobQueue/AssetStore/ResourceReferences. Preview/export/taps must read the correct retained domain without restarting DSP at a requested range. Preserve downstream order and raw source reads. Explicit model preparation and distribution/build readiness belong here; never download implicitly during an edit.

Verify real gain-before/after noncommutation, dry bypass, split/trim/poison isolation, exact duration/latency and bounded range/full equality, historical revision identities and model-free retained reads. Add only model-specific joins to existing cancellation/retry/restart/fencing/portability tests; no second store or queue. Verify public authoring/discovery/refusal and prepared inspection through CLI/MCP. Runtime scope must remain discoverably constrained until the complete [15a3](./15a3-denoise-acceptance.md) and parent contract is verified.
