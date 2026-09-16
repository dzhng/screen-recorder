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

Public missing-role and explicit worker retry scenarios still need real integration
checks. Core tests cover these policies, but do not replace public execution.
Numerical spectra do not prove listening quality or physical microphone/system
capture. SDK audio receipt does not prove a particular AI consumer can hear it.
