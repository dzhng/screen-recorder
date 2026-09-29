# Independent agent use of animated gain

A fresh agent used only the product skill, selected CLI help and an isolated
public service to author a linear clip gain/window, inspect dry/processed taps,
split the clip, replay requests and reject an invalid clock domain. The unchanged
[report](REPORT.md) records complete-sample numerical results and discovery friction.

All96,000 stereo scalar samples were compared with an independently derived
continuous linear envelope. The consumer chose1e-7 full-scale error before its
measurement and observed a7.44e-9 maximum. This is its scoped usability check,
not a replacement for the production numerical contract or the existing exact
[gain conformance gates](../16-gain/README.md). Outside-window PCM and split
preservation are byte-exact. It made no listening or retimed-audio claim.

The service used frozen native6663e0c and root9e0fd7e8-era compiled seed/output
ownership, with later changes confined to harnesses/docs. It was stopped after
the consumer completed and its scratch home removed. No user library, installed
app, capture or speaker playback was used. The first launcher flag placement was
rejected before any agent ran; that setup error is retained.

The consumer found caller curve keys incorrectly advertised read-only. The
[discovery correction](../25-input-schema/README.md) fixes that annotation at the
shared CLI/MCP JSON-schema boundary without changing immutable runtime arrays.
The original report remains unchanged.

The archive contains requests, responses, help, scripts and delivered WAVs;
files.json pins every retained member. Cache paths and socket IDs in receipts
are historical provenance. The supplied synthetic source was created by the
existing audio-project-fixture writeSourceWave helper (source0, one second).
