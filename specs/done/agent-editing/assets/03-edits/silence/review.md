# Authored silence

A silence occurrence has identity, track and placement, but no asset, stream,
source timestamp or pitch metadata. It contributes to project duration and uses
ordinary clip partitioning and placement transforms. Source queries omit it;
acquisition gaps in admitted media still return their source identity with
`available: false`. This is the composition primitive for explicit padding,
not a generated audio file or a claim of native mixing acceptance.

All 65 composition tests, type checking and build pass. The existing
`composition.mjs --fixture repeat-reorder` corpus gate also passes. The
[initial red test](red.txt) precedes silence support. Tests cover asset-free
placement and duration, split/retime, source-clock omission, acquisition gaps,
normalized anchors, rejected source anchors and forbidden media/pitch fields.

Independent Codex review found no actionable defects. Its additional probes
covered silence with attached media through trim, duplicate, move, insertion,
removal and ripple while preserving source mapping for real media. Media-only
fixtures retain their original source/placement contract; their tests now name
the media shape explicitly where TypeScript requires narrowing the clip union.

Hold/silence replacement expansion and the complete linked-replacement harness
remain unfinished. Native silence execution belongs to the audio compiler/mixer.
