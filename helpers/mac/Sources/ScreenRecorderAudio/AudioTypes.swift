import Foundation
import ScreenRecorderMedia

/// Capture stores narration and system audio as separate files, so an excerpt names which of them
/// it is reading rather than describing a mix mode. One track is the separate-track excerpt; both
/// tracks together are the mix.
public enum AudioRole: String, Codable, Sendable, CaseIterable {
    case narration
    case system
}

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

/// Capture roles belong to the recording mix plan, independently of source selection.
public struct AudioTrackPlan: Codable, Sendable, Equatable {
    public let role: AudioRole
    public let source: String
    public let sourceOffsetUs: Int64
    public let available: [TimeSpan]
    public init(role: AudioRole, source: String, sourceOffsetUs: Int64, available: [TimeSpan]) {
        self.role = role
        self.source = source
        self.sourceOffsetUs = sourceOffsetUs
        self.available = available
    }
}

extension AudioTrackPlan {
    var selection: AudioSourceSelection {
        AudioSourceSelection(source: source, sourceOffsetUs: ExactTime(Int128(sourceOffsetUs)), available: available.map(ExactRange.init))
    }
}

public struct AudioExcerptRequest: Sendable {
    public let tracks: [AudioTrackPlan]
    public let spans: [TimeSpan]
    public let output: URL
    public init(tracks: [AudioTrackPlan], spans: [TimeSpan], output: URL) {
        self.tracks = tracks
        self.spans = spans
        self.output = output
    }
}

public enum AudioLimits {
    public static let maximumExcerptUs: Int64 = 30_000_000
    public static let maximumSpans = 1_000
    /// Internal movie plans share the video renderer's bounded metadata capacity.
    public static let maximumRetainedSpans = 10_000
    public static let maximumRetainedAvailableIntervals = 10_000
    /// Acquisition intervals one track may claim, so a plan's validation stays bounded.
    public static let maximumAvailableIntervals = 1_000
    /// Ramp length at a join, before clamping to half of a short span.
    public static let joinRampUs: Int64 = 5_000
    /// Bound format-dependent decode/conversion storage before opening sample buffers.
    /// The supported output layouts are narrower: capture and retained playback are mono/stereo.
    public static let maximumSampleRate = 192_000
    public static let maximumChannels = 8
}

/// What one planned track contributed. `unavailable` lists the parts of the requested spans this
/// track holds no media for — outside the caller's acquired intervals, or inside them but with no
/// occupied segment in the file. Those regions are silent in the output and must never be read as
/// recorded silence.
public struct AudioSourceReport: Sendable {
    public let gain: Double
    public let sampleRate: Int
    public let channels: Int
    public let unavailable: [ExactRange]
}

public struct AudioTrackReport: Codable, Sendable, Equatable {
    public let role: AudioRole
    public let gain: Double
    public let sampleRate: Int
    public let channels: Int
    public let unavailable: [TimeSpan]
    public init(role: AudioRole, source: AudioSourceReport) throws {
        self.init(role: role, gain: source.gain, sampleRate: source.sampleRate,
            channels: source.channels, unavailable: try source.unavailable.compactMap {
                let span = try $0.roundedSpan()
                return span.endUs > span.startUs ? span : nil
            })
    }
    public init(
        role: AudioRole, gain: Double, sampleRate: Int, channels: Int, unavailable: [TimeSpan]
    ) {
        self.role = role
        self.gain = gain
        self.sampleRate = sampleRate
        self.channels = channels
        self.unavailable = unavailable
    }
}

/// `frames` and `sampleRate` are what the file actually holds; `durationUs` is derived from them
/// and differs from the requested span total by at most the rounding of the excerpt's final frame,
/// however many spans it concatenates.
public struct AudioExcerpt: Codable, Sendable, Equatable {
    public let file: String
    public let mediaType: String
    public let sampleRate: Int
    public let channels: Int
    public let frames: Int64
    public let durationUs: Int64
    public let bytes: Int
    public let spans: [TimeSpan]
    public let tracks: [AudioTrackReport]
}
