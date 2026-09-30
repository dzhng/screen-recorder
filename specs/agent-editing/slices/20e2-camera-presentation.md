# 20e2 — Preserve ordered camera pictures and native display duration

Status: implemented and verified offline, through saved-take recovery and ordinary
public source/preview consumers. [Evidence](../assets/20e-camera-presentation/README.md)
and [root integration](../assets/20e-camera-presentation/root-verification.json).
Owning contract: [20e](20e-selected-device-probe.md). This supersedes 20e1's
assumption that every nominal callback-duration hole is unavailable video, while
preserving exact acquired-picture identity, bounded support and durable recovery.

## Evidence and correction

[Retained observations](../assets/20e-camera-admission/observations.json) contain
2,957 endpoint-based rejections, of which 2,956 still have forward timestamps.
2,933 overlap the previous nominal endpoint by exactly 10 microseconds. The
next delivered picture was discarded before encoding; no device-drop event
establishes those manufactured holes as camera outages. Lost pixels cannot be
reconstructed from the saved take. Originals and historical mappings stay intact.

A callback's nominal duration is not a valid ordering constraint on the next
picture. Admit valid pictures whose exact mapped presentation timestamp is strictly
increasing; reject duplicate/backward timestamps without adding a tolerance.
Compare against the corrected writer’s evolving last accepted PTS, not the
historical acceptance set used to measure this defect.
Retain callback duration as provenance and an upper bound on the terminal endpoint.
Name its acquisition meaning explicitly rather than silently treating it as a
final display-availability range.

During an uninterrupted capture, use the movie's native presentation durations.
Displaying an existing picture until the next one does not invent another acquired
picture: its original timestamp and pixel identity remain unchanged. This matches
the generic source reader's existing variable-frame-rate behavior. Do not infer
outage from nominal-duration arithmetic or callback frequency.

Preserve positive camera start, shared pause removal, and the verified terminal
endpoint. Never extend the final picture to screen duration or past camera loss.
The existing lifecycle terminates on interruption/disconnect and does not reconnect
inside the take; no new availability state machine or run schema is needed here.
Explicit unavailable support must have an actual lifecycle/source boundary.

## One owner and implementation boundary

Keep admission in ProbeCameraWriter, clock conversion and sealing in
ProbeClockIngress, and canonical verification/replay in ProbeCameraMedia. Reuse
NativeCapture termination, CaptureJournalLease and NewFile publication. Change no
generic source reader, codec policy, production camera role, or installed app.

Verify the physically readable mapped prefix and all retained journal structure.
Compare exact acquired PTS, count and complete decoded BGRA against raw encoded
pictures. Derive presentation support from native media, bounded by first/terminal
acquisition evidence, rather than constructing an empty edit after every callback.
Retain explicit partial diagnostics and never fabricate absent accepted tails.
A required native-bounded presentation identity on the durable receipt fences
older sparse-gap results without altering or overwriting their files.
On interrupted recovery, the terminal bound belongs to the last physically
decoded mapped picture, not a later journal-only picture. Intersect its nominal
endpoint with that picture’s actual native display endpoint; an encoder may end
the sample earlier than the nominal duration without changing its acquired PTS.

Prefer the smallest existing native trim/copy/publication path that proves these
properties. The failed sparse-edit writer/reader experiments, including the
[five-picture reproduction](../assets/20e-selected-device-probe/packet-reproduction/README.md),
remain evidence, not adopted implementations. A candidate must work through ordinary public source and
render consumers as well as the recovery verifier.

## Verification and review

- Exercise the real admission seam with the retained rational cadence and all
  observed overlap magnitudes, including strictly forward starts, exact duplicates
  and backward starts. Separate these outcomes from encoder backpressure.
- Encode/publish a compact distinguishable sequence reproducing the observed
  3334/3333-tick cadence. Every admitted picture must survive once, with exact PTS
  and raw-to-canonical pixel identity. Include an uninterrupted sparse/VFR case.
- Ordinary import/frame selection between pictures must retain the previous
  picture's identity and timestamp. Verify start and terminal unavailability
  separately; replace the old sparse-callback-equals-outage assertion explicitly.
- Keep pause/resume, stop while paused, post-seal input, startup failure/discard,
  interruption, torn mapping, physically truncated prefix, receipt replay, changed
  input and no-replacement conflict checks. No lost source pixel may be guessed.
- Reuse the saved physical fixture for recovery and ordinary consumer checks.
  Do not claim corrected acquisition of its already rejected pictures or authorize
  another capture. Physical synchronization acceptance remains separate.

Use the existing offline capture harness and frozen source identities; build only
in an isolated scratch path. Apply refactor-clean, code-review and write-docs before
committing. For delivered visual evidence, compare the actual previous/held picture
and boundary behavior, then run unprimed screenshot-critique. User listening gates
and the one-frame physical timing bound are not changed by this correction.

Delegated: internal implementation and focused test construction within the existing
owners. No tolerance, new frame synthesis, format sweep, lifecycle rewrite or
backward-compatibility layer is implied.
