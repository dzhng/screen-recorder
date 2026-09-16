# Public audio inspection checkpoint

The generated fixture runs the packaged app from a Finder-like environment, its
bundled service/native worker, public socket, CLI and official MCP SDK. It starts
no screen or microphone capture. The durable behavioral guard is
[audio-inspection.test.mjs](../../../../apps/macos/tests/audio-inspection.test.mjs).

## Evidence

Two four-second 48 kHz tone sources carry independent 1 kHz narration and 400 Hz
system audio. Removing source seconds 1–2 maps playback 0.5–2.5 seconds to source
0.5–1 and 2–3.5. The narration acquisition gap at source 2.5–3 is explicit in
metadata and loses its 1 kHz component in excerpt seconds 1–1.5; the system tone
continues. Spectral assertions distinguish real samples from plausible metadata.

CLI output and MCP audio content are byte-identical WAVE files. Current and
historical reads preserve their retained spans; repeat requests reuse publication.
Actual cache eviction while the app is stopped, followed by restart, increments
the same pinned request's generation and recreates identical bytes. Source media
and journal hashes remain unchanged.

The test was falsified by changing the built service's native audio dispatch to an
unknown operation: it failed with the worker refusal, then passed after restoration.
An initial test assertion incorrectly used excerpt coordinates for unavailable
intervals; the native contract uses source coordinates, so the assertion was
corrected from that contract. A one-byte cache budget exercises eviction; zero is
invalid by the cache contract.

Focused checks: 101 core tests, 56 service tests, 11 CLI tests and 9 protocol tests;
service/CLI build and type checks passed. Native opaque-output regression passed
alongside the audio wire suite and native numerical suite. The admission regression
proves a foreground frame can run while a 45-take source backlog drains.

## Review and limits

The shape review retained one cache, queue and byte-transfer owner, consolidating
the repeated CLI media-operation set. Independent built-in review found no
correctness/lifetime defect. Codex review found no actionable regressions; its
socket tests were sandbox-blocked, while the integrating host ran them successfully.
Documentation retains source-time absence and separate audition gates.

Numerical spectra do not prove listening quality or physical microphone/system
capture. SDK audio receipt does not prove a particular AI consumer can hear it.

## Absence and retry verification

The packaged integration now checks both roles with the other role unrequested or
requested but never acquired. Public refusal carries the matching absence reason;
mix retains that reason and produces the available track at unity. Independently
decoded PCM equals the original single-track PCM, so gain metadata alone cannot
pass the check. Deliberately conflating the absence reasons made this test fail
at the expected reason assertion; restoring production code returned it green.

An incomplete generated fixture supplies acquired intervals but initially omits
its audio container. Native decoding fails. The initial public test exposed that
all native audio errors were classified terminal, preventing explicit recovery.
The native wire now permits explicit retry for NATIVE_DECODE_FAILED only; invalid
request/range/output plans retain their terminal classification. This error family
covers source access, AVFoundation decoding, resource allocation and output I/O;
it contains no parameter-validation failures. Some media failures may persist,
so this permission makes no recovery guarantee and adds no automatic retry loop.

The test creates the missing synthetic file only inside its temporary fixture.
Three ordinary reads still return the exact failed state. Explicit audio.retry
then publishes a one-second excerpt under the same job and pinned revision;
repeating retry on ready reuses that publication, and the generated source hash
remains unchanged. This is fixture repair, not a product source-repair operation.

Verification on 2026-09-16: packaged build succeeded; all three public audio tests
passed, including the prior CLI/MCP parity/cuts/cache proof; all four native wire
audio tests passed. The new wire assertion checks retryable decode failure beside
terminal invalid-range failure. No screen or audio capture was started. Shape and
diff review retain the existing queue retry policy and one wire envelope owner;
no new storage, endpoint, dependency or background loop was added.

All 28 native wire tests also pass against this worktree's release worker,
including frame, visual-sample, source-evidence and protocol neighbors. Formatting
and focused lint pass. Independent Codex review found no actionable regression;
it did not run tests because it looked for a debug worker, while this pass's
runtime evidence uses the packaged release worker explicitly. Documentation links
remain reachable from the active spec through the public-audio slice.
