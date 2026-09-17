# Public package audio — 14c3c2b

The existing audio.get/retry operations now accept the same exclusive package
selector as frame inspection. The shared audio controller/planner validates acquired
tracks before queue admission; native sample and receipt validation remain common
to library and portable reads. Package frame/audio policy shares the existing
bounded context jobs, output reservations and read leases. No package recording
rows, new operation name, cache, scheduler or decoder were added.

## Verification and limits

The [public audio fixture](../../../../apps/macos/tests/package-public-audio.mjs)
opens a generated no-narration ZIP after its original library is removed. Native
WAVE bytes and metadata match the shared materializer through CLI files and MCP
audio content for system and mix, acquisition gaps, a cut and retained history.
A mix containing only acquired system audio retains unity gain and reports missing
narration; explicit narration selection reports UNAVAILABLE before native work.
Default revision is the exported pin, not the newest included history revision.

Forty interleaved frame/audio requests exercise their shared receipt/output budget.
Held audio remains readable through reclamation and same-ID library deletion;
evicted requests regenerate. Two opens stay independent; closing one revokes only
its own deliveries before TTL expiry. Restart invalidates the remaining handle.
Archive hashes remain unchanged and owned service/native process groups terminate.
The common media-failure fixture proves explicit retry and close while an actual
native audio process is confirmed stopped: cleanup follows its terminal event.

This is transport and sample parity, not human audition or narrated-package/ASR
acceptance. Existing generated library audio tests separately preserve two-track
mix, gap and failure behavior. Package narration readiness remains its prior gate.

## Gate receipts

- Fresh release build: eight targets; type checks: eleven tasks.
- Core: 324 tests; service: 99 tests; CLI: 21; protocol: 13.
- Actual fresh bundled native: six generated library-audio and package audio,
  frame and index tests passed in 37.38 seconds. Package audio took 12.47 seconds.
- Independent Codex review: no actionable regressions; 35 focused core tests and
  types passed. Its broad attempt was constrained by sandbox socket permissions;
  native/socket acceptance comes from the unrestricted owned runs above.
- Changed-file lint and diff whitespace checks passed.

[Compact result](public-package-audio.json), [native log](public-package-audio-native.log),
[core log](public-package-audio-core.log), [service log](public-package-audio-service.log).

The cleanup-omission mutation failed because four published bytes remained charged
instead of zero; restoring cleanup returned the audio tests to green. Initial
native journey setup omitted the relocation baseline owner, first leaving its
output directory absent and then its required result.json absent. Restoring the
shared relocatedReader contract fixed those fixture failures; product limits and
assertions stayed unchanged. Shape review reduced duplicated frame/audio policy,
code review is clean, and the owning slice retains explicit acceptance boundaries.
