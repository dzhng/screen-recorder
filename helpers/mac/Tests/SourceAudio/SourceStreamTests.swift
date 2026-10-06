@preconcurrency import AVFoundation
import Foundation
import YapAudio
import YapMedia

func verifySourceStream(in directory: URL) async throws {
    let source = try fixture(rate: 48_000, channels: 2, name: "stream-sink", seconds: 0.6)
    let file = try AVAudioFile(forReading: source, commonFormat: .pcmFormatFloat32, interleaved: true)
    precondition(file.length == 28_800, "Fixture must contain the complete selected window")
    var expected: [Float] = []
    let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 8_192)!
    while expected.count < 57_600 {
        try file.read(into: buffer, frameCount: AVAudioFrameCount(min(8_192, (57_600 - expected.count) / 2)))
        precondition(buffer.frameLength > 0, "Reference readback ended before the fixture's declared frame count")
        expected.append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![0],
            count: Int(buffer.frameLength) * 2))
    }
    try expected.withUnsafeBufferPointer {
        try Data(buffer: $0).write(to: directory.appendingPathComponent("stream-expected.f32"))
    }
    let selection = AudioSourceSelection(source: source.path, sourceOffsetUs: ExactTime(0),
        available: [ExactRange(startUs: 0, endUs: 600_000)])
    let range = ExactRange(startUs: 0, endUs: 600_000)
    let sourceBytes = try Data(contentsOf: source)
    let stream = try await AudioPCMStream.open(source: selection, range: range)
    precondition(stream.format.sampleRate == 48_000 && stream.format.channels == 2
        && stream.frames == 28_800)
    var actual: [Float] = []
    var blockFrames: [Int] = []
    var invalidBlock: [String: Int64]?
    try await stream.consume { block in
        let expectedStart = Int64(actual.count / 2)
        if invalidBlock == nil && (block.startFrame != expectedStart || block.frameCount <= 0
            || block.frameCount > AudioPCMStream.maximumBlockFrames
            || block.samples.count != block.frameCount * 2) {
            invalidBlock = ["startFrame": block.startFrame, "expectedStartFrame": expectedStart,
                "frameCount": Int64(block.frameCount), "sampleCount": Int64(block.samples.count)]
        }
        actual.append(contentsOf: block.samples)
        blockFrames.append(block.frameCount)
        await Task.yield()
    }
    try actual.withUnsafeBufferPointer {
        try Data(buffer: $0).write(to: directory.appendingPathComponent("stream-actual.f32"))
    }
    if let invalidBlock {
        try JSONSerialization.data(withJSONObject: invalidBlock, options: [.prettyPrinted, .sortedKeys])
            .write(to: directory.appendingPathComponent("stream-invalid-block.json"))
        preconditionFailure("Selected-source blocks must be contiguous and bounded: \(invalidBlock)")
    }
    precondition(actual == expected && actual.count == 57_600
        && actual.allSatisfy { $0.isFinite } && actual.contains { abs($0) > 0.05 })
    let waveStream = try await AudioPCMStream.open(source: selection, range: range)
    let output = directory.appendingPathComponent("stream.wav")
    let bytes = try await AudioWave.write(waveStream, to: output)
    let wavePCM = try wave(output)
    precondition(wavePCM.rate == 48_000 && wavePCM.channels == 2 && wavePCM.samples == expected,
        "The independent WAVE consumer must preserve every selected-source PCM value")

    enum SinkFailure: Error { case thirdBlock }
    let failed = try await AudioPCMStream.open(source: selection, range: range)
    var accepted = 0
    var failedSamples: [Float] = []
    var completed = false
    var caught = false
    do {
        try await failed.consume { block in
            precondition(block.startFrame == Int64(failedSamples.count / 2))
            accepted += 1
            failedSamples.append(contentsOf: block.samples)
            if accepted == 3 { throw SinkFailure.thirdBlock }
        }
        completed = true
    } catch SinkFailure.thirdBlock { caught = true }
    try failedSamples.withUnsafeBufferPointer {
        try Data(buffer: $0).write(to: directory.appendingPathComponent("stream-failed-prefix.f32"))
    }
    let metrics: [String: Any] = ["frames": stream.frames, "blockFrames": blockFrames,
        "waveBytes": bytes, "acceptedBeforeFailure": accepted,
        "completedAfterFailure": completed, "caughtOriginalFailure": caught,
        "failedPrefixSamples": failedSamples.count, "decodedBeforeFailure": failed.decodedFrames]
    try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("stream.result.json"))
    precondition(accepted == 3 && caught && !completed,
        "The original third-block sink error must stop consumption without a fourth block: \(metrics)")
    precondition(failedSamples == Array(expected.prefix(failedSamples.count))
        && failedSamples.count < expected.count,
        "The failed sink must have received an exact, unfinished prefix of the selected source")
    let remainingBytes = try Data(contentsOf: source)
    precondition(remainingBytes == sourceBytes)
    print("PASS selected-source stream: exact 28800 stereo frames in bounded blocks/WAVE; third-block sink error propagates with no later delivery")
}
