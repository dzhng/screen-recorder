import CryptoKit
import Foundation
import YapMedia

public struct SourceChannelPCMResult: Encodable, Sendable {
    public let file: String
    public let bytes: Int
    public let sha256: String
    public let sampleRate = 16_000
    public let channels = 1
    public let frames: Int64
    public let channel: Int
    public let sourceChannels: Int
    public let sourceSampleRate: Int
    public let sourceOffsetUs: ExactTime
    public let range: ExactRange
    public let decodedFrames: Int64
    public let recipe = SourceChannelPCM.recipe
    public let representation = "float32-le"
    public let providerVersion: String
}

/// One complete observation through the shared decoder, retaining exactly one requested channel.
public enum SourceChannelPCM {
    public static let recipe = "source-selected-span-avfoundation-f32-16k-v1"
    public static var providerVersion: String { ProcessInfo.processInfo.operatingSystemVersionString }
    public static func write(source: AudioSourceSelection, range: ExactRange, channel: Int, output: URL)
        async throws -> SourceChannelPCMResult {
        let startFrame = try range.startUs.sample(16_000)
        guard try range.startUs.compare(ExactTime(Int128(startFrame) * 1_000_000, 16_000)) == .orderedSame else {
            throw NativeFailure("INVALID_REQUEST", "Channel PCM must start on the 16k sample grid.")
        }
        let endFrame = try range.endUs.sample(16_000), expectedFrames = endFrame - startFrame
        guard try range.endUs.compare(ExactTime(Int128(endFrame) * 1_000_000, 16_000)) == .orderedSame,
            expectedFrames > 0 && expectedFrames <= 480_000 else {
            throw NativeFailure("INVALID_REQUEST", "Channel PCM requires a complete sample-grid range of at most 30 seconds.")
        }
        let stream = try await AudioPCMStream.open(source: source, spans: [range], sampleRate: 16_000,
            strictWindowFormat: true)
        guard channel >= 0 && channel < stream.format.channels else {
            throw NativeFailure("INVALID_REQUEST", "Channel PCM channel is not present in the selected source.")
        }
        guard stream.frames == expectedFrames && stream.format.sampleRate == 16_000,
            stream.reports.allSatisfy({ $0.unavailable.isEmpty }) else {
            throw NativeFailure("UNAVAILABLE_SUPPORT", "Channel PCM requires complete selected physical support.")
        }
        var pcm = Data()
        pcm.reserveCapacity(Int(expectedFrames) * 4)
        var frames: Int64 = 0
        try await stream.consume { block in
            guard block.startFrame == frames, block.frameCount > 0,
                block.samples.count == block.frameCount * stream.format.channels,
                frames + Int64(block.frameCount) <= expectedFrames else {
                throw NativeFailure.decodeFailed("Channel PCM blocks changed their physical frame support.")
            }
            var selected: [UInt32] = []
            selected.reserveCapacity(block.frameCount)
            for frame in 0..<block.frameCount {
                let sample = block.samples[frame * stream.format.channels + channel]
                guard sample.isFinite else {
                    throw NativeFailure.decodeFailed("Channel PCM contains nonfinite samples.")
                }
                selected.append(sample.bitPattern.littleEndian)
            }
            selected.withUnsafeBufferPointer { pcm.append(Data(buffer: $0)) }
            frames += Int64(block.frameCount)
        }
        guard frames == expectedFrames && pcm.count == Int(expectedFrames) * 4 else {
            throw NativeFailure.decodeFailed("Channel PCM ended before its complete physical frame support.")
        }
        try Task.checkCancellation()
        let destination = try NewFile(at: output.path, assembledAs: "channel.f32")
        defer { destination.discard() }
        try destination.write(pcm)
        try Task.checkCancellation()
        let bytes = try destination.publish()
        return SourceChannelPCMResult(file: output.path, bytes: bytes,
            sha256: SHA256.hash(data: pcm).map { String(format: "%02x", $0) }.joined(),
            frames: frames, channel: channel, sourceChannels: stream.format.channels,
            sourceSampleRate: stream.reports[0].sampleRate, sourceOffsetUs: source.sourceOffsetUs,
            range: range, decodedFrames: stream.decodedFrames,
            providerVersion: providerVersion)
    }
}
