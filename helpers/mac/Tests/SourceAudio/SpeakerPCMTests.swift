@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

func verifySpeakerPCM(in directory: URL) async throws {
    func sample(_ frame: Int, _ channel: Int) -> Float {
        channel == 0 ? Float(frame % 101) / 200 : -Float(frame % 79 + 1) / 160
    }
    let source = try fixture(rate: 16_000, channels: 2, name: "speaker-channels", seconds: 32,
        sample: sample)
    let before = try Data(contentsOf: source)
    let range = ExactRange(startUs: ExactTime(2_000_125, 2), endUs: ExactTime(62_000_125, 2))
    let selection = AudioSourceSelection(source: source.path, sourceOffsetUs: ExactTime(250_000),
        available: [ExactRange(startUs: 250_000, endUs: 32_250_000)])
    let expectedSamples = (12_001..<492_001).map { sample($0, 1) }
    let expected = expectedSamples.withUnsafeBufferPointer { Data(buffer: $0) }
    try expected.write(to: directory.appendingPathComponent("speaker-expected.f32"))
    let output = directory.appendingPathComponent("speaker-actual.f32")
    let receipt = try await SourceSpeakerPCM.write(source: selection, range: range, channel: 1, output: output)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
    try encoder.encode(receipt).write(to: directory.appendingPathComponent("speaker-pcm-receipt.json"))
    let actual = try Data(contentsOf: output)
    let after = try Data(contentsOf: source)
    try after.write(to: directory.appendingPathComponent("speaker-source-after.caf"))
    precondition(actual == expected, "Selected speaker PCM must retain channel one without averaging or shifting its source start")
    precondition(receipt.frames == 480_000 && receipt.sampleRate == 16_000 && receipt.channels == 1)
    precondition(receipt.channel == 1 && receipt.sourceChannels == 2 && receipt.sourceSampleRate == 16_000)
    precondition(receipt.sha256 == SHA256.hash(data: actual).map { String(format: "%02x", $0) }.joined())
    precondition(receipt.range == range && receipt.sourceOffsetUs == selection.sourceOffsetUs)
    precondition(after == before, "Source bytes changed during selected-channel decoding")
    print("PASS exact30s speaker PCM:480000 unchanged channel-one Float32 samples, fractional normalized source clock, complete rate/frame/hash receipt")
    try await verifySpeakerFormatChange(in: directory)
}

private func verifySpeakerFormatChange(in directory: URL) async throws {
    let stereo = try await pcmMovie(fixture(rate: 16_000, channels: 2,
        name: "speaker-stereo-half", seconds: 16, sample: { _, channel in channel == 0 ? 0.25 : -0.5 }))
    let mono = try await pcmMovie(fixture(rate: 16_000, channels: 1,
        name: "speaker-mono-half", seconds: 16, sample: { _, _ in 0.75 }))
    let composition = AVMutableComposition()
    let target = composition.addMutableTrack(withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid)!
    for (index, file) in [stereo, mono].enumerated() {
        let asset = AVURLAsset(url: file)
        let track = try await asset.loadTracks(withMediaType: .audio)[0]
        try target.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 15, timescale: 1)),
            of: track, at: CMTime(value: Int64(index * 15), timescale: 1))
    }
    let source = directory.appendingPathComponent("speaker-changing-channels.mov")
    try await AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        .export(to: source, as: .mov)
    let asset = AVURLAsset(url: source)
    let track = try await asset.loadTracks(withMediaType: .audio)[0]
    let descriptions = try await track.load(.formatDescriptions)
    let channels = descriptions.map { Int(CMAudioFormatDescriptionGetStreamBasicDescription($0)!.pointee.mChannelsPerFrame) }
    precondition(channels == [2, 1], "Format-change control must retain both original channel descriptions")
    let segments = try await track.load(.segments)
    let extent = try await track.load(.timeRange)
    precondition(segments.allSatisfy { !$0.isEmpty } && extent.start == .zero
        && extent.duration == CMTime(value: 30, timescale: 1),
        "Format-change control must have complete physical thirty-second support")
    let before = try Data(contentsOf: source)
    let range = ExactRange(startUs: 0, endUs: 30_000_000)
    let selection = AudioSourceSelection(source: source.path, sourceOffsetUs: ExactTime(0), available: [range])
    let output = directory.appendingPathComponent("speaker-changing-channel-unverified.f32")
    var refusal: NativeFailure?
    do {
        _ = try await SourceSpeakerPCM.write(source: selection, range: range, channel: 1, output: output)
    } catch let failure as NativeFailure { refusal = failure }
    let after = try Data(contentsOf: source)
    let report: [String: Any] = [
        "sourceChannels": channels, "selectedChannel": 1,
        "sourceSha256": SHA256.hash(data: before).map { String(format: "%02x", $0) }.joined(),
        "sourceUnchanged": before == after, "refusal": refusal?.code ?? NSNull(),
        "outputExists": FileManager.default.fileExists(atPath: output.path),
    ]
    try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys, .prettyPrinted])
        .write(to: directory.appendingPathComponent("speaker-format-change.json"))
    precondition(refusal?.code == "UNSUPPORTED_FORMAT", "Changing source channels must refuse, never synthesize the selected channel")
    precondition(before == after && !FileManager.default.fileExists(atPath: output.path))
    print("PASS speaker format-change refusal: stereo→mono cannot synthesize selected channel one")
}
