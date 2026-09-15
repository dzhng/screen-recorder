import Foundation

/// A half-open kept-source interval, already resolved by the timeline owner.
/// This library never interprets edits; it only searches inside the supplied interval.
public struct FrameInterval: Codable, Sendable, Equatable {
    public let startUs: Int64
    public let endUs: Int64
    public init(startUs: Int64, endUs: Int64) {
        self.startUs = startUs
        self.endUs = endUs
    }
}

/// Crop rectangle in oriented source-image pixels, origin at the top left.
public struct FrameCrop: Codable, Sendable, Equatable {
    public let x: Int
    public let y: Int
    public let width: Int
    public let height: Int
    public init(x: Int, y: Int, width: Int, height: Int) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

public enum FrameLimits {
    /// Public times are safe integer microseconds on both sides of the wire.
    public static let maximumMicroseconds: Int64 = 9_007_199_254_740_991
    public static let defaultLongEdge = 1600
    public static let maximumLongEdge = 8192
    public static let maximumEncodedBytes = 32 * 1024 * 1024
}

public struct FrameRequest: Sendable {
    public let atSourceUs: Int64
    public let kept: FrameInterval
    public let output: URL
    public let crop: FrameCrop?
    public let maxLongEdge: Int
    public let maxEncodedBytes: Int

    public init(
        atSourceUs: Int64, kept: FrameInterval, output: URL, crop: FrameCrop? = nil,
        maxLongEdge: Int = FrameLimits.defaultLongEdge,
        maxEncodedBytes: Int = FrameLimits.maximumEncodedBytes
    ) {
        self.atSourceUs = atSourceUs
        self.kept = kept
        self.output = output
        self.crop = crop
        self.maxLongEdge = maxLongEdge
        self.maxEncodedBytes = maxEncodedBytes
    }
}

/// The sample actually chosen inside the kept interval. `actualSourceUs` is the sample's own
/// presentation timestamp, never the requested time.
public struct FrameSelection: Sendable, Equatable {
    public let actualSourceUs: Int64
    public let distanceUs: Int64
}

public struct DecodedFrame: Codable, Sendable, Equatable {
    public let file: String
    public let mediaType: String
    public let requestedSourceUs: Int64
    public let actualSourceUs: Int64
    public let distanceUs: Int64
    public let width: Int
    public let height: Int
    public let sourceWidth: Int
    public let sourceHeight: Int
    public let crop: FrameCrop?
    public let bytes: Int
}

/// Codes: `INVALID_RANGE` (times, intervals, crops, limits), `INVALID_OUTPUT` (output path),
/// `UNAVAILABLE` (no sample inside the interval), `LIMIT_EXCEEDED` (encoded size),
/// `NATIVE_DECODE_FAILED` (media open, decode or encode).
public struct FrameFailure: Error, LocalizedError, Codable, Sendable, Equatable {
    public var errorDescription: String? { message }
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}
