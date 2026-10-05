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
}
