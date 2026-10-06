# Planning review

Reviewed 2026-10-05. Verdict: ready to begin corpus certification; implementation
and media acceptance remain unstarted.

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
