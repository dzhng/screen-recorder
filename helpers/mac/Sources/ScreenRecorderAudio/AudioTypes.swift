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
///
/// `available` is the caller's validated acquisition evidence: the recording source intervals this
/// track was actually capturing over, ascending and non-touching, and possibly starting before
/// recording source zero. It is required, because a container cannot supply it — a decoder happily
/// returns padding or codec priming for a range nothing was acquired over, and relabelling that as
/// recorded silence would pass a hole off as evidence of a quiet microphone. The excerpt reads only
/// where this list and the file's own occupied segments agree; an empty list means nothing was
/// acquired and every requested span is reported unavailable.
public struct AudioTrackPlan: Codable, Sendable, Equatable {
    public let role: AudioRole
    public let source: String
    public let sourceOffsetUs: Int64
    public let available: [SourceSpan]
    public init(role: AudioRole, source: String, sourceOffsetUs: Int64, available: [SourceSpan]) {
        self.role = role
        self.source = source
        self.sourceOffsetUs = sourceOffsetUs
        self.available = available
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
    public let spans: [SourceSpan]
    public let tracks: [AudioTrackReport]
}

/// Codes: `INVALID_REQUEST` (track set), `INVALID_RANGE` (times, spans and available intervals),
/// `INVALID_OUTPUT` (output path), `LIMIT_EXCEEDED` (excerpt duration, span and interval counts,
/// source format bounds), `UNSUPPORTED_FORMAT` (a channel layout combination this owner will not
/// invent a mapping for), `NATIVE_DECODE_FAILED` (media open, decode or write).
public struct AudioFailure: Error, LocalizedError, Codable, Sendable, Equatable {
    public var errorDescription: String? { message }
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}
