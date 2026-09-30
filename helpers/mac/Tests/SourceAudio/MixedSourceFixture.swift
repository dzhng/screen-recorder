@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

/// One shared physical clock covers earlier video, later audio and a true empty audio edit.
/// The positive donor pattern makes every output zero attributable to the declared gap.
func verifyMixedAVSupport(in directory: URL) async throws {
    let videoURL = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../../specs/agent-editing/assets/00-corpus/video-only.mov")
        .standardizedFileURL
    func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    let videoHash = digest(try Data(contentsOf: videoURL))
    precondition(videoHash == "b56a096acd4faf9ab43691e29960eaa4631b3be3ea85fab85861447cbcfaedf7")
    let firstCount = 24_017, secondCount = 24_000, gapFrames = 4_800
    let count = firstCount + secondCount
    let donor = try await pcmMovie(fixture(rate: 48_000, channels: 1, name: "mixed-av-donor",
        frameCount: count + 4096, sample: { frame, _ in Float((frame * 37) % 251 + 1) / 512 }))
    let videoAsset = AVURLAsset(url: videoURL), audioAsset = AVURLAsset(url: donor)
    defer { withExtendedLifetime((videoAsset, audioAsset)) {} }
    let video = try await videoAsset.loadTracks(withMediaType: .video)[0]
    let audio = try await audioAsset.loadTracks(withMediaType: .audio)[0]
    let composition = AVMutableComposition()
    let picture = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    picture.naturalTimeScale = 6_000_000
    try picture.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 2, timescale: 1)),
        of: video, at: CMTime(value: 2_000_002, timescale: 6_000_000))
    let sound = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    sound.naturalTimeScale = 6_000_000
    for (sourceFirst, frames, placedFirst) in [(0, firstCount, 0), (firstCount, secondCount, firstCount + gapFrames)] {
        try sound.insertTimeRange(CMTimeRange(start: CMTime(value: Int64(sourceFirst), timescale: 48_000),
            duration: CMTime(value: Int64(frames), timescale: 48_000)), of: audio,
            at: CMTime(value: 2_000_004 + Int64(placedFirst) * 125, timescale: 6_000_000))
    }
    let file = directory.appendingPathComponent("fractional-mixed-av-gap.mov")
    try await AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!.export(to: file, as: .mov)
    let metadata = try await MediaProbe.inspect(url: file)
    precondition(metadata.originUs == ExactTime(1_000_001, 3))
    precondition(metadata.streams.count == 2)
    let visual = metadata.streams.first { $0.kind == "video" }!
    let audible = metadata.streams.first { $0.kind == "audio" }!
    precondition(visual.startUs == ExactTime(0) && visual.endUs == ExactTime(2_000_000))
    precondition(audible.startUs == ExactTime(1, 3) && audible.endUs == ExactTime(2_200_709, 2))
    let physical = audible.segments!.filter { !$0.empty }.map { ExactRange(startUs: $0.startUs, endUs: $0.endUs) }
    let expectedSupport = [
        ExactRange(startUs: ExactTime(1, 3), endUs: ExactTime(1_000_709, 2)),
        ExactRange(startUs: ExactTime(1_200_709, 2), endUs: ExactTime(2_200_709, 2)),
    ]
    let gap = ExactRange(startUs: ExactTime(1_000_709, 2), endUs: ExactTime(1_200_709, 2))
    precondition(physical == expectedSupport)
    precondition(audible.segments!.contains { $0.empty && $0.startUs.numerator < 0 })
    precondition(audible.segments!.contains { $0.empty && $0.startUs == gap.startUs && $0.endUs == gap.endUs })
    let range = ExactRange(startUs: audible.startUs!, endUs: audible.endUs!)
    let selection = AudioSourceSelection(source: file.path, streamId: audible.id,
        sourceOffsetUs: try ExactTime(0).subtract(metadata.originUs), available: physical)
    let readable = try await AudioPCMStream.readableIntervals(of: selection)
    precondition(readable == expectedSupport)
    let sourcePCM = (0..<count).map { Float(($0 * 37) % 251 + 1) / 512 }
    let expected = Array(sourcePCM[..<firstCount]) + [Float](repeating: 0, count: gapFrames)
        + Array(sourcePCM[firstCount...])
    let fullFile = directory.appendingPathComponent("fractional-mixed-av-gap-full.wav")
    let full = try await SourceAudio.write(source: selection, range: range, output: fullFile)
    let actual = try wave(fullFile).samples
    let expectedBytes = expected.withUnsafeBytes { Data($0) }
    let actualBytes = actual.withUnsafeBytes { Data($0) }
    precondition(full.frames == Int64(count + gapFrames) && actualBytes == expectedBytes)
    precondition(full.unavailable == [gap])
    precondition(actual[..<firstCount].allSatisfy { $0 != 0 }
        && actual[firstCount..<(firstCount + gapFrames)].allSatisfy { $0 == 0 }
        && actual[(firstCount + gapFrames)...].allSatisfy { $0 != 0 })
    let lateFirst = firstCount - 127
    let lateRange = ExactRange(startUs: try range.startUs.adding(ExactTime(Int128(lateFirst) * 1_000_000, 48_000)),
        endUs: range.endUs)
    let lateFile = directory.appendingPathComponent("fractional-mixed-av-gap-late.wav")
    let late = try await SourceAudio.write(source: selection, range: lateRange, output: lateFile)
    let latePCM = try wave(lateFile).samples
    let lateBytes = latePCM.withUnsafeBytes { Data($0) }
    precondition(late.frames == Int64(expected.count - lateFirst) && lateBytes == expectedBytes.dropFirst(lateFirst * 4))
    precondition(late.unavailable == [gap] && late.sampleRange.start == Int64(lateFirst)
        && late.sampleRange.end == Int64(expected.count))
    func wire<Value: Encodable>(_ value: Value) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value), options: .fragmentsAllowed)
    }
    let oracle: [String: Any] = [
        "fixture": file.path, "fixtureSha256": digest(try Data(contentsOf: file)),
        "videoDonorSha256": videoHash, "sampleRate": 48_000, "channels": 1,
        "sourceFrames": count, "sourcePattern": "Float((sourceFrame * 37) % 251 + 1) / 512",
        "sourceFrameRuns": [[0, firstCount], [firstCount, count]],
        "outputFrameRuns": [[0, firstCount], [firstCount + gapFrames, expected.count]],
        "gapFrames": [firstCount, firstCount + gapFrames], "outputFrames": expected.count,
        "lateFirstFrame": lateFirst, "allSourceSamplesNonzero": true,
        "fullPCMHash": digest(actualBytes),
        "latePCMHash": digest(lateBytes),
        "fullRange": try wire(range), "lateRange": try wire(lateRange),
        "unavailable": try wire([gap]), "metadata": try wire(metadata),
        "fullReceipt": try wire(full), "lateReceipt": try wire(late),
    ]
    try JSONSerialization.data(withJSONObject: oracle, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("fractional-mixed-av-gap-oracle.json"))
    print("PASS mixed A/V fractional shared origin, unequal starts, exact100ms gap and full/late PCM: \(file.path)")
}
