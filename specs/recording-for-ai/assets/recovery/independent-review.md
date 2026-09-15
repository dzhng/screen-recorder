## Verification scope

Static review only. I read the full commit diff, the resulting files, `specs/recording-for-ai/{contracts,README}.md`, `slices/02-interruption-recovery.md`, and the existing Swift/node test targets. **I could not build or run anything**: this session's Bash allowlist denied `swift`, `ffmpeg`, and even `command -v`, so no fixture-driven test run happened. Findings below are labelled **Proven** (follows from reading the code alone) or **Hypothesis** (depends on AVFoundation runtime behavior I could not exercise here). Nothing was edited or committed.

---

## High

### H1. Video recovery reports zero coverage, zero duration, and no failure when the sample-cursor probe fails
**Proven.** `MediaRecovery.swift:124` makes every decoded video sample `continue` without appending, so video `intervals` is populated *only* inside `MediaRecovery.swift:132-147`. If `track.makeSampleCursor(presentationTimeStamp:)` returns nil, or `currentSampleDuration` is non-numeric/zero, `intervals` stays `[]`.

- **Trigger:** any track that can't vend sample cursors (the code never checks `AVAssetTrack.canProvideSampleCursors`), or a final sample whose cursor duration reads as zero.
- **Consequence:** the response is internally contradictory and silently catastrophic — `decodedSamples: N>0`, `decodeReachedEnd: true`, `failure: null`, `intervals: []`, and `durationUs: 0` at `MediaRecovery.swift:42`. A consumer cannot distinguish "no video survived" from "the duration probe failed", and the take is discarded. This is the single most important output of the operation.
- **Minimal correction:** always build the interval from decoded timing, and use the cursor only to extend the last sample:
  ```swift
  if let first = firstVideoTime, let last = lastVideoTime {
      let cursor = track.canProvideSampleCursors ? track.makeSampleCursor(presentationTimeStamp: last) : nil
      let tail = cursor.map(\.currentSampleDuration).flatMap { $0.isNumeric && $0 > .zero ? $0 : nil } ?? .zero
      intervals = [MediaInterval(start: first, end: CMTimeAdd(last, tail))]
  }
  ```

### H2. The cursor is positioned with a *track-timeline* timestamp but navigates the *media* timeline
**Hypothesis** (premise is the documented `AVSampleCursor` contract; I could not run it here). `lastVideoTime` (`MediaRecovery.swift:98`) comes from `AVAssetReaderTrackOutput`, which emits edit-list-applied track times. `makeSampleCursor(presentationTimeStamp:)` positions at or near the *media sample* with that timestamp. When the track carries a non-identity edit list — which AVAssetWriter writes for H.264 with frame reordering to trim the initial composition offset, and `AVVideoCompressionPropertiesKey` at `CaptureWriter.swift:93-95` does not disable B-frames — the cursor lands on a different sample than the last decoded one.

- **Consequence:** `durationUs` is computed from the wrong sample's duration. Harmless for CFR media; ScreenCaptureKit output is variable-duration (frames only on change), so the last frame's duration can be hundreds of ms to seconds off, and the recovered duration is wrong in exactly the direction that matters — the tail.
- **Why the tests can't see it:** the fixture at `recovery.test.mjs:49-62` is `testsrc2 … rate=10`, i.e. constant frame duration, where every sample's duration is identical and a mispositioned cursor returns the right answer anyway. This is the refactor-clean "symmetric placeholder hides an orientation bug" rule verbatim.
- **Minimal correction:** verify before trusting — `guard cursor.presentationTimeStamp == last` (or subtract `range.start` to convert into media time) and otherwise fall back to the last decoded inter-sample delta.

### H3. `acquisitionVerified: true` is reported while the journal silently erases every decoded audio interval
**Proven** (behavior), reachability Medium. At `MediaRecovery.swift:38-39`, `acquired` is `[]` — not `nil` — whenever the journal has a header but no `audioSamples` records for that role. `MediaRecovery.swift:181` then intersects with `[]`, producing `intervals: []`, and `MediaRecovery.swift:196` reports `acquisitionVerified: true` because the flag only asks whether a journal existed.

- **Trigger:** `CaptureJournal.inspect` returns early on the *first* malformed record (`CaptureJournal.swift:111-114`), dropping every later record. Any invalid record ahead of a role's first `audioSamples` erases that role entirely.
- **Consequence:** real, decodable narration is advertised as unrecovered with `failure: null` and a flag asserting the acquisition was *verified*. The consumer has no way to distinguish "the journal proves nothing arrived" from "the journal never got to say". This directly contradicts `helpers/mac/README.md` ("Without a journal, physical audio ranges remain available but acquisition verification is false") and slice 02's "Only media that actually decodes is advertised as recovered".
- **Minimal correction:** two parts — (a) make the flag mean what it says: `acquisitionVerified = role == "video" || (acquired != nil && journal?.incompleteTail == false)`; (b) don't intersect beyond the journal's coverage — clip `acquired` proof to `[0, lastAcquiredEnd]` and keep decoded intervals past that point, marked unverified rather than deleted.
- Note `recovery.test.mjs:149-152` currently *pins* the lossy half of this (decoded 700–750 ms is dropped because the journal was torn), so the fix requires updating that expectation deliberately.

---

## Medium

### M1. The commit's central mechanism — movie fragmentation — has no test or recorded evidence
**Proven.** `CaptureWriter.swift:31-32` enables 5 s/1 s fragments; every automated fixture in `recovery.test.mjs` is a *finalized* ffmpeg file. No test produces an unfinalized fragmented MOV, and no Swift test covers `MediaRecovery` or `CaptureJournal` at all (`Tests/ScreenRecorderCaptureTests/` has only `CaptureClockTests` and `HeldTailFrameTests`).

All three mechanisms recovery leans on are `moov`-derived — `track.load(.timeRange)` (`:149`), `track.load(.segments)` (`:167`), `makeSampleCursor` (`:133`) — and in a fragmented file the `moov` is written ~1 s in, before most of that information exists. Whether AVFoundation reconstitutes them from `moof` is exactly what slice 02 says to measure first ("Test AVAssetWriter file fragmentation before building a segment store… not by an untested recovery claim"), yet `helpers/mac/README.md` now asserts the crash-prefix guarantee.

**Minimal correction:** `HeldTailFrameTests.swift:61` already stands up a real `AVAssetWriter` with synthetic frames and needs no capture permission — extend that shape: write N seconds of fragmented video, copy the file mid-write (or truncate it at a byte offset), and assert `MediaRecovery.inspect` returns the expected prefix. That is the missing `lab:recovery` checkpoint and it is cheap here.

### M2. `media.recover` is unbounded work serialized on the worker's only request loop
**Proven.** `main.swift:5` awaits `NativeWire.respond` per line; `Wire.swift:19` awaits a full `MediaRecovery.inspect`, which decodes every sample of all three tracks (`MediaRecovery.swift:34`) — and `MediaRecovery.swift:70-73` requests `kCVPixelFormatType_32BGRA`, forcing a full H.264 decode *plus* colour conversion of every frame just to read presentation timestamps.

- **Consequence:** an hour-long 4K take blocks the entire helper for minutes with no timeout, cancellation, or progress. Every other operation queues behind it. `contracts.md:210-212` sets bounds on every other operation family ("Cursor queries require a bounded time range (max60 seconds)"); this one has none.
- **Minimal correction:** drop the pixel-format setting (pass `outputSettings: nil`) unless proving decodability is the point — and if it is, say so and bound it: cap frames probed, or make the operation return a job handle rather than blocking the loop. `output.alwaysCopiesSampleData = false` (`:74`) is a rounding error next to the decode it doesn't avoid.

### M3. A torn tail and a corrupt mid-file record are reported identically
**Proven.** `CaptureJournal.swift:111-114` sets `incompleteTail = true` and returns for *any* decode failure at any offset, dropping every subsequent record — including a `finished` marker.

- **Consequence:** a take that completed cleanly is reported unfinished, and (via H3) its audio evidence is truncated at the bad record. `incompleteTail` is the name for "the crash cut the last line"; using it for "record 40 of 9000 didn't parse" makes the flag unusable as a crash-boundary signal, which is its only job.
- **Minimal correction:** separate the two — keep `incompleteTail` for `CaptureJournal.swift:121` (unterminated trailing bytes) and add an explicit `invalidAtSequence: Int?` for a mid-file parse failure, so the consumer can tell a crash boundary from corruption.

### M4. Per-audio-buffer journal records, plus an fsync on the realtime sample queue
**Proven** (cost), **Hypothesis** (that it causes observable drops). `CaptureWriter.swift:262-269` writes one `audioSamples` record per delivered buffer — roughly 47/s per audio role, ~94/s with both — and each one runs a fresh `JSONEncoder` plus two `JSONSerialization` passes (`CaptureJournal.swift:47-50`) on the same serial queue that appends video to the encoder, with `expectsMediaDataInRealTime = true`. That's ~9 KB/s, ~30 MB/hour of journal whose entire information content is the *gap boundaries* — `CaptureJournal.swift:99-105` merges contiguous ranges back down at read time, so ~5000 records collapse into one.

Separately, `CaptureWriter.swift:179` performs a durable `fsync` (`handle.synchronize()`) inside `stream(_:didOutputSampleBuffer:)` for the first video frame, and at every pause/resume boundary; on APFS that can block tens of ms on the queue feeding a `queueDepth: 3` stream, and a stall there shows up as `dropped` frames.

**Minimal correction:** coalesce at the write path — track the open range and emit a record only when a gap appears or a bounded checkpoint elapses (a crash then loses at most one checkpoint interval, which is the same guarantee fragmentation gives the media). Move durable appends to a dedicated serial journal queue so ordering is preserved without blocking sample delivery.

### M5. Recovery reports a `MISSING_MEDIA` failure for tracks that were never requested
**Proven.** `MediaRecovery.swift:34` always probes all three roles; `recovery.test.mjs:71` pins `tracks[2].failure.code === "MISSING_MEDIA"` for a take with no system audio. The journal header carries `microphone`/`systemAudio` (`CaptureJournal.swift:10-11`) and is already loaded before the track loop.

- **Consequence:** a consumer reading per-track failures sees a loss signal for a track that was deliberately never captured. `contracts.md` calls legitimate absence "an explicit allowed absence" and reserves interrupted status for *requested* tracks that are missing.
- **Minimal correction:** when `journal?.header` is present, use its `microphone`/`systemAudio` flags to distinguish absent-by-design from lost, e.g. a `NOT_REQUESTED` code or omitting the track entirely.

---

## Low

- **L1 — Positional duration.** `MediaRecovery.swift:42` reads `tracks[0]` and depends on `"video"` being first in the literal at `:34`. Use `tracks.first { $0.role == "video" }`.
- **L2 — Inconsistent parsing of two events.** `CaptureJournal.swift:85-86` uses `data["hostUs"] as? Int64`, which yields `nil` on a malformed value while every other event throws `INVALID_JOURNAL`. A lost `openPauseHostUs` — the unfinished-pause boundary the reader exists to preserve — disappears with no signal. Decode these through `JSONDecoder` like the rest.
- **L3 — Write-only journal data.** `JournalTrackStart` (`CaptureJournal.swift:131-137`) is written on every take and has no reader (`default: break` at `:108`); the `finished` record carries a full `CaptureResult` that `:107` discards in favour of a boolean. Either consume them or record only the marker.
- **L4 — Three owners for one filename.** `"capture.journal.jsonl"` appears at `CaptureJournal.swift:15`, `:36`, and `:56`; `"\(role).mov"` is derived independently at `CaptureWriter.swift:28` and `MediaRecovery.swift:49`. Two things that must agree, no owner.
- **L5 — Hand-written Codable keys silently drop fields.** `CaptureJournalSummary`'s explicit `CodingKeys` (`:16-19`) omits `acquiredAudio`; the wire contract is now whatever someone remembered to list, and `recovery.test.mjs:143` pins the omission. Adding a field to the struct won't reach consumers. A constant (`file`) is encoded while real state isn't.
- **L6 — Journal fixture is hand-built, never round-tripped.** `recovery.test.mjs:103-137` constructs journal JSON by hand rather than through `CaptureJournal.append`, so writer/reader field drift is undetectable (code-review §12). A Swift round-trip test in the existing `ScreenRecorderCaptureTests` target closes this in a few lines.
- **L7 — `try!` on the response path.** `Wire.swift:20` traps on any encoding failure and kills a long-lived worker. Nothing in `RecoveredCapture` can throw today, so this is latent, not live — but it's a suppression in the one place that must always answer.
- **L8 — Wire dependency direction.** `Package.swift:13` makes the transport target depend on the capture stack, so the JSON boundary can no longer build or be tested without AVFoundation/ScreenCaptureKit, and `Wire.swift:15-31` grows an if/else chain per operation. Consider a shared types target and a dispatch table before the third operation lands.
- **L9 — ffmpeg is now a hard gate dependency.** `apps/macos/package.json` runs `node --test helpers/mac/Tests/*.test.mjs`; `recovery.test.mjs:14-15` asserts `result.error === undefined`, so a machine without ffmpeg fails the macOS gate with an opaque spawn error. Add a presence check with an actionable skip/message.
- **L10 — Spec not updated.** `slices/02-interruption-recovery.md:3` still reads "Status: not started" after the slice's core mechanism landed; `README.md:48` is unticked; no `choices.md` entry records the fragmentation decision (5 s/1 s) that the slice explicitly delegates ("Record the chosen format and remove the alternative from product code"), nor the measured loss window its acceptance section requires. The two preceding commits in this series (`24e7d96`, `de76afa`) both updated specs alongside code.

---

## Verdict

**Not clean.** H1 and H3 are silent data-loss defects in the operation's primary outputs (`durationUs` and per-track `intervals`) that report success while returning nothing, and both are invisible to the current tests. M1 is the structural issue behind several of the others: the commit ships a crash-recovery *claim* in `helpers/mac/README.md` while every test fixture is a finalized, constant-frame-rate file — the one artifact class this code exists for is never constructed. I'd fix H1 and H3, then add the fragmented-writer test from M1 before treating slice 02's mechanism choice as decided.
