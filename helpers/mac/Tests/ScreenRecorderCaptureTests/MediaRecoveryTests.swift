@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

private func track(_ role: String, of capture: RecoveredCapture) -> RecoveredTrack {
    guard let found = capture.tracks.first(where: { $0.role == role }) else {
        preconditionFailure("Recovery must report a \(role) track")
    }
    return found
}

/// A take trimmed to a window of its source: its presentation timeline restarts at zero while its
/// media timestamps stay where they were. The window's own frames last 100ms each except the last,
/// which lasts 400ms, so reading the media table 200ms early reads a different, shorter frame
/// rather than the same number twice.
private func runEditListTailTests() async throws {
    let directory = RecoveryFixture.directory("recovery-edit-list")
    defer { try? FileManager.default.removeItem(at: directory) }
    let source = directory.appendingPathComponent("source.mov")
    try await RecoveryFixture.writeVariableDurationVideo(
        to: source,
        timesUs: [
            0, 100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000,
            1_000_000, 1_500_000, 1_600_000, 1_700_000, 1_800_000, 2_300_000, 2_400_000, 2_500_000,
            3_000_000,
        ],
        // Every frame a sync sample, so the trim below copies exactly the window and the fixture
        // means the same thing on every machine.
        keyFrameInterval: 1)
    let take = directory.appendingPathComponent("video.mov")
    try await RecoveryFixture.writeTrimmedCopy(
        of: source, to: take,
        mediaWindow: CMTimeRange(
            start: time(microseconds: 1_200_000), duration: time(microseconds: 1_000_000)))

    let asset = await RecoveryFixture.videoTrack(of: take)
    let segments = SourceSegment.occupied(of: try await asset.load(.segments))
    precondition(
        segments.count == 1 && microseconds(segments[0].media.start) == 200_000
            && microseconds(segments[0].asset.start) == 0,
        "Fixture must carry one non-identity edit, or it cannot tell the two time domains apart")
    let stamps = await RecoveryFixture.decodedPresentationMicroseconds(of: take)
    precondition(
        stamps == [0, 300_000, 400_000, 500_000, 600_000],
        "Fixture must decode the trimmed window's five frames, got \(stamps)")

    // The last frame is shown from 600ms to the end of the one-second window.
    let recovered = await MediaRecovery.inspect(directory: directory.path)
    let video = track("video", of: recovered)
    precondition(
        RecoveryFixture.bounds(video.intervals) == [[0, 1_000_000]],
        "Trimmed take must recover its whole window, got \(RecoveryFixture.bounds(video.intervals))")
    precondition(video.failure == nil, "A readable take must not fail: \(video.failure!.message)")
    precondition(
        recovered.durationUs == 1_000_000,
        "Recovered duration must be the window, got \(recovered.durationUs)")

    // Positioning the cursor with the asset timestamp lands 200ms earlier in media time, on a
    // 100ms frame. That shortfall is under the track's own range, so nothing downstream clips it
    // away: this fixture separates the two formulas rather than hiding one behind a clamp.
    guard let misplaced = asset.makeSampleCursor(presentationTimeStamp: time(microseconds: 600_000))
    else { preconditionFailure("Fixture must provide sample cursors") }
    let byAssetTime = 600_000 + microseconds(misplaced.currentSampleDuration)
    precondition(
        byAssetTime == 700_000,
        "Fixture must make the asset-timestamped cursor answer 700000us, got \(byAssetTime)")
    print("PASS edit-list take recovers 1000000us where an asset-timestamped cursor reports \(byAssetTime)us")

    // The tail is only reported when a cursor confirms the sample that carries it.
    precondition(
        assetEnd(ofSamplePresentedAt: time(microseconds: 600_000), in: [], of: asset) == nil,
        "A sample outside every occupied segment has no stated duration")
    precondition(
        assetEnd(ofSamplePresentedAt: time(microseconds: 4_000_000), in: segments, of: asset) == nil,
        "A time past the edit list has no stated duration")
    print("PASS unconfirmed sample tails resolve to no duration rather than a neighbour's")
}

/// The crash the fragment interval exists for: media written but never finalized.
private func runCrashedFragmentTests() async throws {
    let directory = RecoveryFixture.directory("recovery-fragment")
    defer { try? FileManager.default.removeItem(at: directory) }
    let live = directory.appendingPathComponent("live.mov")
    let crashed = directory.appendingPathComponent("video.mov")
    let submitted = try await RecoveryFixture.writeCrashedFragmentedVideo(
        to: live, copyTo: crashed, timesUs: (0..<90).map { Int64($0) * 33_333 })
    // A cancelled writer removes its own output; only the copy a crash would have left survives.
    precondition(
        !FileManager.default.fileExists(atPath: live.path),
        "An abandoned writer must leave only the copied prefix behind")

    let recovered = await MediaRecovery.inspect(directory: directory.path)
    let video = track("video", of: recovered)
    precondition(
        (video.decodedSamples ?? 0) > 0 && video.decodeReachedEnd,
        "An unfinalized take must decode a prefix, got \(String(describing: video.decodedSamples)) samples")
    precondition(
        video.failure == nil, "A decodable prefix is not a failure: \(video.failure!.message)")
    precondition(
        video.intervals.count == 1 && video.intervals[0].startUs == 0,
        "A crash prefix must start at the take's origin, got \(RecoveryFixture.bounds(video.intervals))")
    let end = video.intervals[0].endUs
    precondition(
        end > 0 && end <= submitted.last! + 33_333,
        "A crash prefix must not claim more than was submitted: \(end) of \(submitted.last! + 33_333)")
    precondition(
        recovered.durationUs == end,
        "Recovered duration must be the video prefix, got \(recovered.durationUs)")
    print("PASS unfinalized fragmented take recovers \(end)us of \(submitted.last! + 33_333)us submitted")
}

/// Audio a take never asked for is absent by design; audio it did ask for and lost is not.
private func runUnrequestedAudioTests() async throws {
    let directory = RecoveryFixture.directory("recovery-absent-audio")
    defer { try? FileManager.default.removeItem(at: directory) }
    try await RecoveryFixture.writeVariableDurationVideo(
        to: directory.appendingPathComponent("video.mov"), timesUs: [0, 100_000, 200_000])

    let unknown = await MediaRecovery.inspect(directory: directory.path)
    precondition(
        track("narration", of: unknown).failure?.code == "MISSING_MEDIA",
        "Without a journal an absent track is unexplained, got "
            + (track("narration", of: unknown).failure?.code ?? "success"))

    _ = try CaptureJournal(
        directory: directory.path,
        header: CaptureJournalHeader(
            schemaVersion: 1, sessionID: "absent-audio", source: CaptureSource(kind: "display"),
            width: RecoveryFixture.width, height: RecoveryFixture.height, microphone: true,
            systemAudio: false))
    let declared = await MediaRecovery.inspect(directory: directory.path)
    precondition(
        track("system", of: declared).failure?.code == "NOT_REQUESTED",
        "Audio the header never requested is not a loss, got "
            + (track("system", of: declared).failure?.code ?? "success"))
    precondition(
        track("narration", of: declared).failure?.code == "MISSING_MEDIA",
        "Requested audio that is missing stays a loss, got "
            + (track("narration", of: declared).failure?.code ?? "success"))
    print("PASS unrequested audio reports NOT_REQUESTED while requested audio still reports loss")
}

private func runVideoGapTests() async throws {
    let directory = RecoveryFixture.directory("recovery-video-gap")
    defer { try? FileManager.default.removeItem(at: directory) }
    let source = directory.appendingPathComponent("source.mov")
    try await RecoveryFixture.writeVariableDurationVideo(
        to: source, timesUs: (0..<10).map { Int64($0) * 100_000 }, keyFrameInterval: 1)
    let originalAsset = AVURLAsset(url: source)
    defer { withExtendedLifetime(originalAsset) {} }
    let original = try await originalAsset.loadTracks(withMediaType: .video)[0]
    let composition = AVMutableComposition()
    let copy = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try copy.insertTimeRange(
        CMTimeRange(start: .zero, duration: time(microseconds: 300_000)),
        of: original, at: .zero)
    copy.insertEmptyTimeRange(
        CMTimeRange(start: time(microseconds: 300_000), duration: time(microseconds: 500_000)))
    try copy.insertTimeRange(
        CMTimeRange(start: time(microseconds: 300_000), duration: time(microseconds: 300_000)),
        of: original, at: time(microseconds: 800_000))
    let output = directory.appendingPathComponent("video.mov")
    let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
    try await export.export(to: output, as: .mov)
    let video = await RecoveryFixture.videoTrack(of: output)
    let segments = try await video.load(.segments)
    precondition(segments.contains { $0.isEmpty }, "Fixture must retain an empty video edit")
    let decoded = await RecoveryFixture.decodedPresentationMicroseconds(of: output)
    // AVFoundation may synthesize a padding sample for the empty edit.
    let occupiedSamples = decoded.filter { $0 < 300_000 || $0 >= 800_000 }
    precondition(occupiedSamples == [0, 100_000, 200_000, 800_000, 900_000, 1_000_000],
        "Decoded occupied fixture times: \(occupiedSamples)")
    let recovered = await MediaRecovery.inspect(directory: directory.path)
    let intervals = RecoveryFixture.bounds(track("video", of: recovered).intervals)
    precondition(intervals == [[0, 300_000], [800_000, 1_100_000]],
        "Empty video edits are not acquired coverage: \(intervals)")
    precondition(recovered.durationUs == 1_100_000)
    print("PASS video recovery preserves an empty middle edit as a gap")
}

func runMediaRecoveryTests() async throws {
    try await runEditListTailTests()
    try await runCrashedFragmentTests()
    try await runUnrequestedAudioTests()
    try await runVideoGapTests()
    try await runLegacyAudioSupportTest()
    try runRecoveryReceiptSizeTest()
}

private func runLegacyAudioSupportTest() async throws {
    let directory = RecoveryFixture.directory("legacy-audio-support")
    defer { try? FileManager.default.removeItem(at: directory) }
    var root = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { root.deleteLastPathComponent() }
    let asset = AVURLAsset(url: root.appendingPathComponent("specs/done/agent-editing/assets/00-corpus/a-audio.wav"))
    let source = try await asset.loadTracks(withMediaType: .audio)[0]
    let composition = AVMutableComposition()
    let target = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try target.insertTimeRange(CMTimeRange(start: .zero, duration: time(microseconds: 500000)), of: source, at: time(microseconds: 250000))
    try await AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        .export(to: directory.appendingPathComponent("narration.mov"), as: .mov)
    try await RecoveryFixture.writeVariableDurationVideo(to: directory.appendingPathComponent("video.mov"), timesUs: [0, 1000000], endUs: 2000000)
    let physical = await MediaRecovery.inspect(directory: directory.path)
    precondition(physical.durationUs == 2000000)
    precondition(RecoveryFixture.bounds(track("narration", of: physical).intervals) == [[250000, 750000]])
    let journal = try CaptureJournal(directory: directory.path, header: CaptureJournalHeader(
        schemaVersion: 1, sessionID: "legacy-support", source: CaptureSource(kind: "window", windowID: 1),
        width: 160, height: 120, microphone: true, systemAudio: false))
    try journal.recordOrigin(hostUs: 1000000)
    try journal.recordAudioSamples(role: "narration", startUs: 250000, endUs: 300000)
    try journal.recordAudioSamples(role: "narration", startUs: 300001, endUs: 400000)
    try journal.recordAudioSamples(role: "narration", startUs: 500000, endUs: 700000)
    try journal.recordPauseBegan(hostUs: 1700000)
    journal.lease.release()
    let handle = try FileHandle(forWritingTo: directory.appendingPathComponent("capture.journal.jsonl"))
    try handle.seekToEnd()
    try handle.write(contentsOf: Data("{\"sequence\":7,\"event\":\"pauseEnded\"".utf8))
    try handle.close()
    let recovered = await MediaRecovery.inspect(directory: directory.path)
    precondition(recovered.journal?.incompleteTail == true && recovered.journal?.openPauseHostUs == 1700000)
    precondition(RecoveryFixture.bounds(track("narration", of: recovered).intervals) == [[250000, 400000], [500000, 700000]])
    precondition(track("narration", of: recovered).acquisitionVerified)
    print("PASS detailed native recovery preserves optional-audio bounds and truncated-journal gaps")
}

private func runRecoveryReceiptSizeTest() throws {
    // A control serialization proof, not a physical capture or container feasibility claim.
    let spans = (0..<100000).map { index in
        TimeSpan(startUs: 20000000000 + Int64(index) * 100000, endUs: 20000000001 + Int64(index) * 100000)
    }
    let input: [String: Any] = ["durationUs": Int64(30000000000), "tracks": ["narration", "system"].map { role in
        ["role": role, "file": "\(role).mov", "intervals": spans.map { ["startUs": $0.startUs, "endUs": $0.endUs] },
         "representedFrames": "100000", "decodeReachedEnd": true, "acquisitionVerified": true] as [String: Any]
    }]
    let recovered = try JSONDecoder().decode(RecoveredCapture.self, from: JSONSerialization.data(withJSONObject: input))
    let full = try JSONEncoder().encode(recovered)
    let receipt = try JSONEncoder().encode(RecoveryReceipt(recovered))
    precondition(full.count > 8 * 1024 * 1024 && receipt.count < 64 * 1024)
    let object = try JSONSerialization.jsonObject(with: receipt) as! [String: Any]
    let tracks = object["tracks"] as! [[String: Any]]
    precondition(tracks.allSatisfy { $0["intervalCount"] as? Int == 100000 && $0["intervals"] == nil })
    precondition(recovered.tracks.allSatisfy { $0.intervals == spans })
    print("PASS bounded recovery receipt \(receipt.count) bytes retains counts; complete native model \(full.count) bytes remains available")
}
