@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

/// Recorded quiet is readable source material; a physical edit-list hole is unavailable even
/// though both produce zero PCM. Source inspection reports that distinction without editing it.
func verifySourceOccupancy(in directory: URL) async throws {
    let source = try fixture(rate: 48_000, channels: 2, name: "occupancy", sample: { frame, channel in
        if (9_600..<14_400).contains(frame) { return 0 }
        return Float((frame * (channel + 3)) % 101 - 50) / 100
    })
    let file = try AVAudioFile(forReading: source, commonFormat: .pcmFormatFloat32, interleaved: true)
    let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat,
        frameCapacity: AVAudioFrameCount(file.length))!
    try file.read(into: buffer)
    let samples = Array(UnsafeBufferPointer(start: buffer.floatChannelData![0],
        count: Int(buffer.frameLength) * 2))
    let (physical, streams) = try await movie([source], name: "occupancy-gapped")
    let sourceBytes = try Data(contentsOf: physical)
    let selected = AudioSourceSelection(source: physical.path, streamId: streams[0],
        sourceOffsetUs: ExactTime(-1_250_000),
        available: [ExactRange(startUs: 0, endUs: 1_000_000)])
    let output = directory.appendingPathComponent("occupancy.output")
    let full = try await SourceAudio.write(source: selected,
        range: ExactRange(startUs: 0, endUs: 1_000_000), output: output)
    let decoded = try wave(output)
    // The authored movie carries source frames [0,19200), an empty edit, then [28800,48000).
    let expected = Array(samples[0..<38_400]) + [Float](repeating: 0, count: 19_200)
        + Array(samples[57_600..<96_000])
    for (name, values) in [("expected", expected), ("actual", decoded.samples)] {
        try values.withUnsafeBufferPointer {
            try Data(buffer: $0).write(to: directory.appendingPathComponent("occupancy-" + name + ".f32"))
        }
    }
    try JSONEncoder().encode(full).write(to: directory.appendingPathComponent("occupancy.result.json"))
    let receipt: [String: Any] = ["source": physical.path, "sourceSHA256": SHA256.hash(data: sourceBytes)
        .map { String(format: "%02x", $0) }.joined(), "streamId": streams[0],
        "sourceOffsetUs": -1_250_000, "physicalGapUs": [400_000, 600_000],
        "recordedQuietUs": [200_000, 300_000], "expectedFrames": 48_000]
    try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("occupancy.operands.json"))
    precondition(full.unavailable == [ExactRange(startUs: 400_000, endUs: 600_000)],
        "Only the physical hole is unavailable; recorded quiet must remain readable: \(full.unavailable)")
    precondition(full.frames == 48_000 && full.sampleRate == 48_000 && full.channels == 2
        && full.layout == "stereo" && decoded.rate == 48_000 && decoded.channels == 2)
    precondition(decoded.samples == expected,
        "Source PCM must preserve both channels and physical placement without introducing fades or changing recorded quiet")
    precondition(decoded.samples.allSatisfy { $0.isFinite }
        && decoded.samples[19_200..<28_800].allSatisfy { $0 == 0 }
        && decoded.samples[38_400..<57_600].allSatisfy { $0 == 0 }
        && decoded.samples[..<19_200].contains { abs($0) > 0.05 }
        && decoded.samples[57_600...].contains { abs($0) > 0.05 })
    let readback = try AVAudioFile(forReading: output)
    precondition(readback.length == 48_000 && readback.processingFormat.sampleRate == 48_000
        && readback.processingFormat.channelCount == 2,
        "Opaque output paths must still publish a valid WAVE in the selected native format")
    let outputBytes = try Data(contentsOf: output)
    precondition(outputBytes.prefix(4) == Data("RIFF".utf8)
        && outputBytes[8..<12] == Data("WAVE".utf8) && full.bytes == outputBytes.count)
    let quietURL = directory.appendingPathComponent("occupancy-quiet.wav")
    let quiet = try await SourceAudio.write(source: selected,
        range: ExactRange(startUs: 200_000, endUs: 300_000), output: quietURL)
    let quietPCM = try wave(quietURL)
    try JSONEncoder().encode(quiet).write(to: directory.appendingPathComponent("occupancy-quiet.result.json"))
    precondition(quiet.unavailable.isEmpty && quiet.frames == 4_800
        && quietPCM.samples == [Float](repeating: 0, count: 9_600),
        "A quiet selected window is available zero PCM, not a physical hole")
    let remainingBytes = try Data(contentsOf: physical)
    precondition(remainingBytes == sourceBytes, "Inspection must leave the selected source intact")
    print("PASS selected-source occupancy: exact 48000 stereo frames, physical gap unavailable, recorded quiet available, native WAVE at opaque output and immutable source")
}
