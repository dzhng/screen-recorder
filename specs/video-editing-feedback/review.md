# Planning and implementation review

Reviewed 2026-10-05, before implementation began. Verdict at that time: ready to
begin corpus certification. The implementation and media acceptance statements
below describe that planning pass and are not the current feature status; the
live handoff and slice verdicts own current progress.

## Architecture and diff review

Applied refactor-clean, code-review and write-docs to the materialized plan. The
scope is new planning/evidence documents plus links and historical-status corrections
in the spec index and old assessment. No production code or installed skill changed.

The canonical plan reuses jobs/models/evidence/publication, exact composition,
native picture/audio and current consumer helpers. Hard cutover/reset boundaries
are explicit; no compatibility seam remains. Speaker acoustic continuity and
explicit display-name binding have one owner each; angle declarations do not
duplicate names or automatically identify audible speakers. Audio preflight extends
the already-existing audio.prepare rather than creating a parallel preparation owner.

Findings resolved during synthesis/review:

- Current import/help/measurement/speaker/alpha capabilities were reconciled with
  historical v0.1.6 reports instead of declared missing wholesale.
- Native timing clamping and zero-width promotion were recorded as investigated
  mechanisms, not proven causes; overlaps/instants remain honest observations.
- Partial-word lexical recovery is a measured gate; acoustic activity cannot name
  a missing word. Caption consumers handle overlaps without fabricating durations.
- Loudness checks remain strict. Audio-only preflight precedes expensive picture
  work; correction recipe/finite budget must freeze before a production port.
- Player/color parity, single-mic sync and long-form speaker identity have explicit
  replication gates. Unsupported FluidAudio candidates are not turnkey promises.
- Visual variables have independent artifacts/masks and final unprimed critique;
  there is no human QA/sign-off gate or default tool installation.
- Vision observations and explicit geometry are retained for replay; detector
  reruns cannot silently substitute a different result.
- Historical session claims distinguish agent speech discoveries, user picture
  direction, inferred energy, sampled coverage and actual rebuilt-media parity.
- Speaker labeling now includes mixed recordings, stable IDs, word attribution
  and explicit naming, superseding the earlier raw-source-only scope.

## Mechanical evidence

Verified JSON parses, all twenty copied-file SHA-256/byte identities, exact-byte
FEEDBACK copy, original session SHA-256 and all forty-four selected public session
record contents/identities. The excerpts contain no private reasoning blocks.
Verified complete B01–B05, E01–E29, S01–S08 and U01–U34 coverage: seventy-six rows.
Verified all thirty-four slice dependencies resolve and form an acyclic graph,
with matching global checklist coverage. Current planning document targets resolve.
Frozen historical source documents retain their original external/missing links;
they are comparison operands, not current navigation or executable instructions.
Tracked diff whitespace checks pass.

No permanent test was added for planning-only data. No rendering, transcription,
inference, product suite, live-device check or visual-output verdict was run in this
pass; those would not prove the changed documents. Independent drafting supplies
planning alternatives, not a product execution pass. Provider quality, compressed
fixture fidelity and the final autonomous workflow must still be established by
their owning slices.

## Implementation closeout evidence

The implementation branches are clean at the verified head; both
`spec/speaker-next` and `spec/video-editing-feedback` point at it. The focused
editing harness is 145/145, composition is 335/335,
protocol is 37/37, core is 794 with one skip, CLI is 112/112, client is 22/22,
and the workbench check passes. The two service cases that timed out during the
first parallel run pass individually; the serialized service lane is 302 passing
with 22 skipped. The standalone native capture suite also passes. The timeline
inspection fixture now supplies the pinned transcript source metadata required by
the current ready-page contract and passes its focused seven-test file.

The non-live completion lane was rerun with the built Sparkle framework selected
explicitly: all 17 filtered package tasks passed, the focused editing harness
passed 145/145, and `test:tools` passed all 164 tests. The new combined A/V
checkpoint is covered by a committed native export and an inference-free replay:
the same MP4 is read through the delivered-scene and public audio owners, with
three scene rows and three decoded PCM landmarks retained separately. Equal
timestamps remain observations; no cross-plane association or shared clock is
claimed.

The serialized repository run reaches the permission-gated macOS integration
tests on this machine's existing Screen & System Audio Recording boundary. Those
checks report `PERMISSION_REQUIRED` and remain explicitly unverified here, as
required by the current environment; no production behavior was changed to hide
that boundary. A bundled-service export case also timed out while the
permission-gated integration process was running. The native unit, service, CLI,
protocol, composition, core, client, workbench and focused editing results above
remain the applicable evidence for this machine.

The implementation review passes for the committed contracts and focused
evidence. The global checklist remains open for the refusal-backed face,
synchronization, strict transition-parity, long-form speaker and fresh live-device
workflow gates recorded in the slice files. No release, tag, push or installed-app
update is part of this review.
