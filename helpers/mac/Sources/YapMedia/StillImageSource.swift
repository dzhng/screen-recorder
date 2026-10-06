import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// One ImageIO decode owns metadata, orientation and pixels for timeless PNG/JPEG sources.
public struct StillImageSource {
    // Same source-work magnitude as the existing picture compositor; release-scale measurement is separate.
    public static let maximumDecodedPixels: Int64 = 8192 * 8192
    public let image: CGImage
    public let codec: String
    public let orientation: Int
    public let hasAlpha: Bool
    public var width: Int { image.width }
    public var height: Int { image.height }
    public var orientedWidth: Int { (5...8).contains(orientation) ? height : width }
    public var orientedHeight: Int { (5...8).contains(orientation) ? width : height }

    /// Unsupported containers return nil so import probing can continue through its timed-media owner.
    public static func open(
        _ url: URL, maximumPixels: Int64 = maximumDecodedPixels
    ) throws -> StillImageSource? {
        guard maximumPixels > 0, maximumPixels <= maximumDecodedPixels else {
            throw NativeFailure("INVALID_REQUEST", "Invalid still-image decoded pixel budget.")
        }
        try Task.checkCancellation()
        guard
            let source = CGImageSourceCreateWithURL(
                url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
            let type = CGImageSourceGetType(source),
            [UTType.png.identifier, UTType.jpeg.identifier].contains(type as String)
        else { return nil }
        guard CGImageSourceGetCount(source) == 1,
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.int64Value,
            let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.int64Value,
            width > 0, height > 0
        else { throw NativeFailure("UNSUPPORTED_MEDIA", "Expected one decodable still image.") }
        let orientation = (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
        guard (1...8).contains(orientation) else {
            throw NativeFailure("UNSUPPORTED_MEDIA", "Invalid still-image orientation.")
        }
        let (pixels, overflow) = width.multipliedReportingOverflow(by: height)
        guard !overflow, pixels <= maximumPixels else {
            throw NativeFailure(
                "LIMIT_EXCEEDED", "Still-image decode exceeds \(maximumPixels) pixels.")
        }
        try Task.checkCancellation()
        guard
            let image = CGImageSourceCreateImageAtIndex(
                source, 0,
                [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
            image.width == width, image.height == height,
            CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete
        else { throw NativeFailure("UNSUPPORTED_MEDIA", "Cannot decode the declared still image.") }
        try Task.checkCancellation()
        return StillImageSource(
            image: image, codec: type as String, orientation: orientation,
            hasAlpha: [.first, .last, .premultipliedFirst, .premultipliedLast, .alphaOnly].contains(
                image.alphaInfo))
    }

    /// EXIF orientation is applied once in source space; downstream geometry sees an upright extent.
    public var oriented: CIImage {
        let value = CIImage(cgImage: image).oriented(forExifOrientation: Int32(orientation))
        return value.transformed(
            by: CGAffineTransform(
                translationX: -value.extent.minX, y: -value.extent.minY))
    }
}
