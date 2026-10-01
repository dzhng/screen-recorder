# External-caller input preparation

This checkpoint turns the supplied [fixture brief](../25-fixture-brief/README.md)
into verified immutable input bindings and an unedited scratch project. It is
preparation for [25](../../slices/25-agent-acceptance.md), not a fresh external
caller's editing, delivery, visual or listening acceptance.

The maintained [preparer](../../../../packages/test-harness/editing/acceptance.mjs)
uses actual CLI/MCP asset import, durable job inspection, asset/segment reads,
project creation/revision reads and model discovery. Source selection requires
one unambiguous supported stream. The physical media origin is authoritative;
human marks also require their original narration hash and origin before mapping
into asset-relative time. Camera, screen and microphone keep separate clocks.
No physical synchronization verdict follows from those bindings.

`caller-inputs.json` and the frozen brief are the handoff to a later fresh caller.
The library home, project/revision, immutable asset selections, source-clock maps,
protected marks and accepted recipe/reference identities are explicit. Replaying
preparation keeps the original request IDs and worker identity. Partial failures
retain their complete reports; resume reuses admitted work and does not add clips,
processing or generated speech. An already edited project cannot silently become
an unedited fixture through resume.

All large originals and retained journals are rehashed read-only against their
existing authorities. The chord bed is extracted from its named verified archive
member; the accepted ambience loop, generated comparison and word context are
rehashes, not new generation or listening trials. The source compiler, import and
file-hash owners stay authoritative; no production endpoint or parallel media
engine is added.

The isolated model statuses are absent. The earlier public readiness proof remains
its own acceptance; this new library has not inherited registered readiness.
Matching historical raw word evidence is retained in the [original transcript](../../../recording-for-ai/assets/speech/boundaries/transcript.json),
pinned by the [speech manifest](../12-speech/manifest.json) to the narrated source.
That proves its historical source binding, not a current registered canonical
receipt or supported adoption. No matching current transcript generation is admitted. Supplied human cut marks
remain valid without transcribing again, while later occurrence-bound captions
must use an actual supported word authority. Another source's transcription
baseline cannot fill that gap. No Parakeet inference, voice synthesis, capture,
playback, UI, installed switch or latency cohort is run here.

[Verification](verification.json) names the actual public cohorts and their limits;
[evidence pins](evidence-pins.json) bind complete requests/replies, both diagnostics,
restart/resume observations, native operation journal and closed catalog. The
[source/runtime pins](source-runtime-pins.json) retain the executed source and
JavaScript. The pinned native and external runtime bytes remain in the immutable
[audio export packet](../09c-audio-export/README.md) and
[native packet](../09c-native-audio-file/README.md); the local runtime resolution
record proves whether those external dependencies still match. [Review](review.md)
and [choices](choices.md) retain the ownership and decision audit.
