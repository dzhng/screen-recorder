import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

func verifySourceStreaming(in parent: URL) async throws {
    let source = parent.appendingPathComponent("streaming-authority.wav")
    let frames: Int64 = 48_000 * 176
    let bytes = frames * 8
    var header = Data("RIFF".utf8)
    func little(_ value: UInt32, count: Int = 4) -> Data {
        Data((0..<count).map { UInt8((value >> ($0 * 8)) & 255) })
    }
    header.append(little(UInt32(bytes + 36)))
    header.append(Data("WAVEfmt ".utf8))
    header.append(little(16))
    header.append(little(3, count: 2))
    header.append(little(2, count: 2))
    header.append(little(48_000))
    header.append(little(48_000 * 8))
    header.append(little(8, count: 2))
    header.append(little(32, count: 2))
    header.append(Data("data".utf8))
    header.append(little(UInt32(bytes)))
    try header.write(to: source)
    let handle = try FileHandle(forWritingTo: source)
    try handle.truncate(atOffset: UInt64(header.count) + UInt64(bytes))
    try handle.seek(toOffset: UInt64(header.count) + UInt64(bytes) - 8)
    try handle.write(contentsOf: little(0x3f000000) + little(0xbf000000))
    try handle.close()
    defer { try? FileManager.default.removeItem(at: source) }
    let inspection = try MediaInput(url: source)
    _ = try await inspection.asset.loadTracks(withMediaType: .audio)
    let metadataBytes = inspection.readWork!.readBytes
    let stream = try await AudioPCMStream.open(source: AudioSourceSelection(
        source: source.path, sourceOffsetUs: ExactTime(0),
        available: [ExactRange(startUs: 0, endUs: 176_000_000)]),
        range: ExactRange(startUs: 0, endUs: 176_000_000))
    var actualFrames: Int64 = 0
    var finalSamples: [Float] = []
    try await stream.consume { block in
        precondition(block.startFrame == actualFrames)
        actualFrames += Int64(block.frameCount)
        finalSamples = Array(block.samples.suffix(2))
    }
    let evidence: [String: Any] = ["sourceBytes": bytes, "metadataReadBytes": metadataBytes,
        "expectedFrames": frames, "actualFrames": actualFrames, "finalSamples": finalSamples]
    try JSONSerialization.data(withJSONObject: evidence, options: [.prettyPrinted, .sortedKeys])
        .write(to: parent.appendingPathComponent("streaming-authority.json"))
    precondition(metadataBytes > 0 && metadataBytes < bytes && actualFrames == frames
        && finalSamples == [0.5, -0.5],
        "Bounded metadata preparation must permit complete unchanged PCM execution beyond64MiB")
    print("PASS bounded metadata and whole-source PCM beyond64MiB preserve all frames and final nonzero stereo samples")
}
