import Foundation
import ScreenRecorderMedia

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

    /// Whether the point addresses a pixel of a `width` by `height` raster. Output pixels are
    /// half-open, as the capture journals them: a coordinate equal to the width is past the edge.
    func isOnRaster(width: Int, height: Int) -> Bool {
        x.isFinite && y.isFinite && x >= 0 && y >= 0 && x < Double(width) && y < Double(height)
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
    public let kept: TimeSpan
    public let output: URL
    /// Drawn in source pixels before the crop, so overlay coordinates and crop coordinates are read
    /// in the same geometry. Absent means a clean frame.
    public let overlay: FrameOverlay?
    public let crop: FrameCrop?
    public let maxLongEdge: Int
    public let maxEncodedBytes: Int

    public init(
        atSourceUs: Int64, kept: TimeSpan, output: URL, overlay: FrameOverlay? = nil,
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

extension FrameOverlay {
    /// Bounds the drawing work and refuses evidence this library would have to guess about: points
    /// off the source raster, points out of order, and runs that overlap in time.
    func validate(width: Int, height: Int) throws {
        let overlay = self
        guard overlay.trailUs >= 0, overlay.trailUs <= FrameLimits.maximumTrailUs else {
            throw NativeFailure(
                "INVALID_RANGE",
                "Trail duration \(overlay.trailUs) is outside 0...\(FrameLimits.maximumTrailUs) microseconds."
            )
        }
        var total = 0
        var previousUs: Int64?
        for run in overlay.trail {
            guard !run.isEmpty else {
                throw NativeFailure("INVALID_RANGE", "A trail run holds no points.")
            }
            total += run.count
            for point in run {
                try validate(point: point, width: width, height: height)
                if let previousUs, point.atSourceUs <= previousUs {
                    throw NativeFailure(
                        "INVALID_RANGE",
                        "Trail point at \(point.atSourceUs) does not follow \(previousUs) microseconds."
                    )
                }
                previousUs = point.atSourceUs
            }
        }
        guard total <= FrameLimits.maximumTrailPoints else {
            throw NativeFailure(
                "INVALID_RANGE",
                "Trail holds \(total) points, over the \(FrameLimits.maximumTrailPoints) point limit."
            )
        }
        guard total == 0 || overlay.trailUs > 0 else {
            throw NativeFailure(
                "INVALID_RANGE", "A trail of \(total) points needs a trail duration.")
        }
        if let pointer = overlay.pointer {
            try validate(point: pointer, width: width, height: height)
        }
    }

    private func validate(point: CursorPoint, width: Int, height: Int) throws {
        guard point.atSourceUs >= 0, point.atSourceUs <= TimeSpan.maximumMicroseconds,
            point.isOnRaster(width: width, height: height)
        else {
            throw NativeFailure(
                "INVALID_RANGE",
                "Cursor point \(point.x),\(point.y) at \(point.atSourceUs)us is not inside the \(width)x\(height) source image."
            )
        }
    }
}
