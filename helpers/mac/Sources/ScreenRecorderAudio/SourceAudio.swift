import Foundation
import ScreenRecorderMedia

public struct SourceAudioResult: Encodable, Sendable {
    public let file: String
    public let mediaType = "audio/wav"
    public let bytes: Int
    public let sampleRate: Int
    public let channels: Int
    public let layout: String
    public let range: TimeSpan
    public struct Samples: Encodable, Sendable {
        public let start: Int64
        public let end: Int64
    }
    public let sampleRange: Samples
    public let decodedFrames: Int64
    public let frames: Int64
    public let unavailable: [TimeSpan]
}

public enum SourceAudio {
    public static func write(source: AudioSourceSelection, range: TimeSpan, output: URL)
        async throws -> SourceAudioResult
    {
        let stream = try await AudioPCMStream.open(source: source, range: range)
        try Task.checkCancellation()
        let bytes = try await AudioWave.write(stream, to: output)
        return SourceAudioResult(
            file: output.path, bytes: bytes,
            sampleRate: stream.format.sampleRate, channels: stream.format.channels,
            layout: stream.format.channels == 1 ? "mono" : "stereo", range: range,
            sampleRange: .init(
                start: try ExactTime(Int128(range.startUs)).sample(stream.format.sampleRate),
                end: try ExactTime(Int128(range.endUs)).sample(stream.format.sampleRate)),
            decodedFrames: stream.decodedFrames, frames: stream.frames,
            unavailable: stream.reports[0].unavailable)
    }
}
