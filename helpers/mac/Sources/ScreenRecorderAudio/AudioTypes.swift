import Foundation
import ScreenRecorderMedia

/// `sourceOffsetUs` maps file time zero into the caller's source clock; subtracting
/// the file origin yields normalized asset time. `available` is support in that
/// same clock, intersected with occupied container segments before decoding.
/// An omitted stream ID is valid only for a file with exactly one audio stream.
public struct AudioSourceSelection: Codable, Sendable, Equatable {
    public let source: String
    public let streamId: String?
    public let sourceOffsetUs: ExactTime
    public let available: [ExactRange]
    public init(source: String, streamId: String? = nil, sourceOffsetUs: ExactTime, available: [ExactRange]) {
        self.source = source
        self.streamId = streamId
        self.sourceOffsetUs = sourceOffsetUs
        self.available = available
    }
}

public enum AudioLimits {
    /// Bound selected-source transcription metadata independently of decoded duration.
    public static let maximumRetainedSpans = 10_000
    public static let maximumRetainedAvailableIntervals = 10_000
    /// Ramp length at a join, before clamping to half of a short span.
    public static let joinRampUs: Int64 = 5_000
    /// Bound format-dependent decode/conversion storage before opening sample buffers.
    /// The supported output layouts are narrower: capture and retained playback are mono/stereo.
    public static let maximumSampleRate = 192_000
    public static let maximumChannels = 8
}

/// What the selected source contributed. `unavailable` lists the parts of the requested spans the source
/// holds no media for — outside the caller's acquired intervals, or inside them but with no
/// occupied segment in the file. Those regions are silent in the output and must never be read as
/// recorded silence.
public struct AudioSourceReport: Sendable {
    public let gain: Double
    public let sampleRate: Int
    public let channels: Int
    public let unavailable: [ExactRange]
}
