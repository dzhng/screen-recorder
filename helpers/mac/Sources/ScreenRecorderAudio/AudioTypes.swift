import Foundation

/// A half-open interval of recording source time, already resolved by the timeline owner.
/// This library never interprets edits; it only reads and concatenates the intervals it is given.
public struct SourceSpan: Codable, Sendable, Equatable {
    public let startUs: Int64
    public let endUs: Int64
    public init(startUs: Int64, endUs: Int64) {
        self.startUs = startUs
        self.endUs = endUs
    }
}

/// Capture stores narration and system audio as separate files, so an excerpt names which of them
/// it is reading rather than describing a mix mode. One track is the separate-track excerpt; both
/// tracks together are the mix.
public enum AudioRole: String, Codable, Sendable, CaseIterable {
    case narration
    case system
}

/// `sourceOffsetUs` is the recording source time at which this file's own time zero sits. Tracks
/// that started after the video are positive; a track carrying material from before recording
/// source zero is negative.
public struct AudioTrackPlan: Codable, Sendable, Equatable {
    public let role: AudioRole
    public let source: String
    public let sourceOffsetUs: Int64
    public init(role: AudioRole, source: String, sourceOffsetUs: Int64) {
        self.role = role
        self.source = source
        self.sourceOffsetUs = sourceOffsetUs
    }
}

public struct AudioExcerptRequest: Sendable {
    public let tracks: [AudioTrackPlan]
    public let spans: [SourceSpan]
    public let output: URL
    public init(tracks: [AudioTrackPlan], spans: [SourceSpan], output: URL) {
        self.tracks = tracks
        self.spans = spans
        self.output = output
    }
}

public enum AudioLimits {
    /// Public times are safe integer microseconds on both sides of the wire.
    public static let maximumMicroseconds: Int64 = 9_007_199_254_740_991
    public static let maximumExcerptUs: Int64 = 30_000_000
    public static let maximumSpans = 1_000
    /// Ramp length at a join, before clamping to half of a short span.
    public static let joinRampUs: Int64 = 5_000
    /// Output bounds. A file claiming more than these would size the excerpt buffer by its own
    /// header rather than by the requested duration.
    public static let maximumSampleRate = 192_000
    public static let maximumChannels = 8
}

/// What one planned track contributed. `unavailable` lists the parts of the requested spans this
/// track holds no media for — an empty edit, material before its own zero, or past its end. Those
/// regions are silent in the output and must never be read as recorded silence.
public struct AudioTrackReport: Codable, Sendable, Equatable {
    public let role: AudioRole
    public let gain: Double
    public let sampleRate: Int
    public let channels: Int
    public let unavailable: [SourceSpan]
    public init(role: AudioRole, gain: Double, sampleRate: Int, channels: Int, unavailable: [SourceSpan]) {
        self.role = role
        self.gain = gain
        self.sampleRate = sampleRate
        self.channels = channels
        self.unavailable = unavailable
    }
}

/// `frames` and `sampleRate` are what the file actually holds; `durationUs` is derived from them
/// and can differ from the requested total by the rounding of one frame per span.
public struct AudioExcerpt: Codable, Sendable, Equatable {
    public let file: String
    public let mediaType: String
    public let sampleRate: Int
    public let channels: Int
    public let frames: Int64
    public let durationUs: Int64
    public let bytes: Int
    public let spans: [SourceSpan]
    public let tracks: [AudioTrackReport]
}

/// Codes: `INVALID_REQUEST` (track set), `INVALID_RANGE` (times and spans), `INVALID_OUTPUT`
/// (output path), `LIMIT_EXCEEDED` (excerpt duration, span count, source format bounds),
/// `NATIVE_DECODE_FAILED` (media open, decode or write).
public struct AudioFailure: Error, LocalizedError, Codable, Sendable, Equatable {
    public var errorDescription: String? { message }
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}
