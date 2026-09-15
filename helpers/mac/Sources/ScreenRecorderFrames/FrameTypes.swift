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

/// One pointer position the core chose, in oriented source-video pixels with a top-left origin.
/// `atSourceUs` is the sample's own time, never the requested frame time.
public struct CursorPoint: Codable, Sendable, Equatable {
    public let atSourceUs: Int64
    public let x: Double
    public let y: Double
    public init(atSourceUs: Int64, x: Double, y: Double) {
        self.atSourceUs = atSourceUs
        self.x = x
        self.y = y
    }
}

/// What to draw over a decoded frame. The core selects every point and has already clipped the
/// trail at pause, cut, scene and geometry boundaries; this library draws exactly what it is given.
///
/// `trail` holds continuously observed runs in ascending time. A gap between two runs is a gap in
/// the evidence — an invisible or missing pointer — and nothing is drawn across it. An absent
/// overlay leaves the frame clean; an overlay with an empty trail and no pointer is an honest
/// statement that there was nothing to draw.
public struct FrameOverlay: Codable, Sendable, Equatable {
    public let trail: [[CursorPoint]]
    /// Age at which a trail point reaches its faintest opacity. The requested trail duration, not
    /// the span the retained points happen to cover, so a trail cut short stays visibly short.
    public let trailUs: Int64
    /// The pointer for the requested moment, drawn opaque above the trail.
    public let pointer: CursorPoint?

    public init(trail: [[CursorPoint]] = [], trailUs: Int64 = 0, pointer: CursorPoint? = nil) {
        self.trail = trail
        self.trailUs = trailUs
        self.pointer = pointer
    }
}

public enum FrameLimits {
    /// Public times are safe integer microseconds on both sides of the wire.
    public static let maximumMicroseconds: Int64 = 9_007_199_254_740_991
    public static let defaultLongEdge = 1600
    public static let maximumLongEdge = 8192
    public static let maximumEncodedBytes = 32 * 1024 * 1024
    /// Mirrors the per-request trail cap the public contract fixes at ten seconds.
    public static let maximumTrailUs: Int64 = 10_000_000
    /// A 60 Hz sampler fills a ten-second trail with 600 points; this leaves headroom for denser
    /// evidence while keeping one request's drawing work and memory bounded.
    public static let maximumTrailPoints = 1_200
}

public struct FrameRequest: Sendable {
    public let atSourceUs: Int64
    public let kept: FrameInterval
    public let output: URL
    /// Drawn in source pixels before the crop, so overlay coordinates and crop coordinates are read
    /// in the same geometry. Absent means a clean frame.
    public let overlay: FrameOverlay?
    public let crop: FrameCrop?
    public let maxLongEdge: Int
    public let maxEncodedBytes: Int

    public init(
        atSourceUs: Int64, kept: FrameInterval, output: URL, overlay: FrameOverlay? = nil,
        crop: FrameCrop? = nil, maxLongEdge: Int = FrameLimits.defaultLongEdge,
        maxEncodedBytes: Int = FrameLimits.maximumEncodedBytes
    ) {
        self.atSourceUs = atSourceUs
        self.kept = kept
        self.output = output
        self.overlay = overlay
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

/// What the renderer actually drew. Times are echoed from the supplied points so a consumer can
/// check the picture against the evidence the core selected.
public struct RenderedOverlay: Codable, Sendable, Equatable {
    public let trailPoints: Int
    public let trailStartUs: Int64?
    public let trailEndUs: Int64?
    public let pointerSourceUs: Int64?

    public init(_ overlay: FrameOverlay) {
        let points = overlay.trail.flatMap { $0 }
        trailPoints = points.count
        trailStartUs = points.first?.atSourceUs
        trailEndUs = points.last?.atSourceUs
        pointerSourceUs = overlay.pointer?.atSourceUs
    }
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
    public let overlay: RenderedOverlay?
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
