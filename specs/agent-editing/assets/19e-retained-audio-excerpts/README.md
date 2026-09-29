# Retained audio excerpt evidence

The public gate exercises `audio.extract` through CLI and MCP with the isolated
native finite-PCM worker. Complete files, actual frame counts and typed origins are
checked; no listening, generation model, live capture or playback was performed.

`report.json` is the final public gate receipt. `evidence.tar.gz` retains complete
selected/converted/output WAVs, real native requests and replies, every intermediate
public failure, focused test logs and independent review output. The archive index
records each file's SHA256 and byte count; archive verification re-reads every member.

## What the gates establish

- Complete canonical reference WAV is identical, including its header, across restart.
  A 17-frame 44.1kHz donor converts to nine 24kHz frames without dropping its last input
  sample. The earlier real 16-versus-17 failure is retained.
- Raw source clocks, project clocks, current and historical taps, acquisition gaps,
  stereo/downmix, non24k rates and integer AIFF selections use explicit provenance.
  Each converted result matches complete selected-PCM native conversion bytes.
- Equal audio from different origins retains those origins. Converted WAV bytes
  previously imported with `.aif` storage naming reuse the same asset. The result
  pins asset/stream IDs, so publication does not pin an incidental filename.
- Cancellation and a crash after native completion publish no asset; explicit retries
  succeed. Donor project deletion, restart and public package export/open/adopt in a
  fresh receiver retain complete excerpt bytes and typed origins without donor access.
- Existing core asset/job/prepared-audio/project-package tests passed (148 tests and one
  inherited skip), as did portable assets (1), service operation tests (21), protocol
  (12) and CLI (20). Nine type/build tasks passed. The public prepared-audio lifecycle
  gate passed, including historical restart, cancellation/retry and processing refusal.

## Review and failure scope

Independent Codex review found no actionable regression and separately ran 63 focused
core tests plus types. It did not run the native public harness. Root review identified
unnecessary filename pinning, now removed and checked with public equal-byte reuse;
its existing shared publication tests own concurrent first-writer behavior.

The archive keeps fixture errors separately from product defects: an extra `range`
passed to a strict selector, a too-long carrier fixture range, a non-UUID export ID,
and rendition accidentally passed to `audio.get` were all correctly refused. Native
probing rejected WAV bytes named `.bin` and `.wave`; `.aif` succeeded. None of those
failures are silently omitted or described as product passes.

The root consumer is supplemental and explicitly not a fresh-model gate. The fresh
consumer uses only the product skill and public CLI help, with its exact requests,
responses and any refusals retained separately. See `verification.json` for its final
status, measured sizes, worker hashes and archive integrity.

The fresh consumer initially invoked the Node CLI through Bun. Bun returned
`INVALID_REQUEST` / `Unexpected EOF` for file-redirection stdin; piping the same
JSON worked. The exact commands and responses are retained. Replaying with the
repository's supported Node 24 runtime parses redirected stdin correctly and
reaches the service; the CLI shebang and package engine already specify Node.
This runtime deviation is not counted as a successful Node request or hidden by
the later pipe workaround.
