import CoreImage
import CoreVideo
import Foundation
import ImageIO
import ScreenRecorderMedia
import UniformTypeIdentifiers

/// Orients a decoded sample, applies an already validated crop, bounds its long edge and encodes
/// it. Crop coordinates arrive in oriented top-left pixels; Core Image works bottom-left, so the
/// vertical flip happens here rather than in the caller.
struct FrameImage {
    let image: CIImage
    let width: Int
    let height: Int

    init(
        buffer: CVPixelBuffer, transform: CGAffineTransform, overlay: FrameOverlay?,
        agedFromUs: Int64, crop: FrameCrop?, maxLongEdge: Int
    ) throws {
        let decoded = CIImage(cvPixelBuffer: buffer)
        // A track's preferred transform is stated in display coordinates, where y grows downward;
        // Core Image grows y upward, so applying it directly turns a quarter turn into a
        // three-quarter turn. Flipping into and out of display space keeps both agreeing.
        let flipDecoded = CGAffineTransform(
            a: 1, b: 0, c: 0, d: -1, tx: 0, ty: decoded.extent.height)
        let displayed = decoded.extent.applying(transform)
        let flipDisplayed = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: displayed.height)
        var oriented = decoded.transformed(
            by: flipDecoded.concatenating(transform).concatenating(flipDisplayed))
        oriented = oriented.transformed(
            by: CGAffineTransform(
                translationX: -oriented.extent.origin.x, y: -oriented.extent.origin.y))
        var visible = oriented.extent
        if let crop {
            visible = CGRect(
                x: CGFloat(crop.x), y: oriented.extent.height - CGFloat(crop.y + crop.height),
                width: CGFloat(crop.width), height: CGFloat(crop.height))
        }
        let sourceWidth = Int(visible.width.rounded())
        let sourceHeight = Int(visible.height.rounded())
        let longEdge = max(sourceWidth, sourceHeight)
        guard longEdge > 0 else {
            throw NativeFailure.decodeFailed("Decoded sample has no pixels.")
        }
        // Drawing happens in source pixels, before the crop and the long-edge bound, so the points
        // the core supplied are read in the geometry they were measured in. The bound that follows
        // shrinks every mark with the frame, so the overlay is told it up front and sizes its
        // strokes for the pixels the caller will actually receive.
        let deliveredScale = longEdge > maxLongEdge ? Double(maxLongEdge) / Double(longEdge) : 1
        if let overlay,
            let drawn = try CursorOverlay.image(
                overlay, agedFromUs: agedFromUs, width: Int(oriented.extent.width.rounded()),
                height: Int(oriented.extent.height.rounded()), visibleLongEdge: Double(longEdge),
                deliveredScale: deliveredScale)
        {
            oriented = CIImage(cgImage: drawn).composited(over: oriented)
        }
        if crop != nil {
            oriented = oriented.cropped(to: visible).transformed(
                by: CGAffineTransform(translationX: -visible.origin.x, y: -visible.origin.y))
        }
        if longEdge > maxLongEdge {
            width = max(1, Int((Double(sourceWidth) * deliveredScale).rounded()))
            height = max(1, Int((Double(sourceHeight) * deliveredScale).rounded()))
            image = oriented.transformed(
                by: CGAffineTransform(
                    scaleX: CGFloat(width) / visible.width, y: CGFloat(height) / visible.height))
        } else {
            width = sourceWidth
            height = sourceHeight
            image = oriented
        }
    }

    /// Bitmap rendering writes top-left rows despite Core Image's geometric bottom-left origin.
    /// Preserve that order so analysis bytes and public frame pixel coordinates agree.
    func rgb(context: CIContext) -> Data {
        var rgba = [UInt8](repeating: 0, count: width * height * 4)
        context.render(
            image, toBitmap: &rgba, rowBytes: width * 4,
            bounds: CGRect(x: 0, y: 0, width: width, height: height),
            format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
        var rgb = Data(capacity: width * height * 3)
        for offset in stride(from: 0, to: rgba.count, by: 4) {
            rgb.append(contentsOf: rgba[offset..<(offset + 3)])
        }
        return rgb
    }

    func png(context: CIContext) throws -> Data {
        guard
            let rendered = context.createCGImage(
                image, from: CGRect(x: 0, y: 0, width: width, height: height))
        else {
            throw NativeFailure.decodeFailed("Cannot render \(width)x\(height) frame.")
        }
        let data = NSMutableData()
        guard
            let destination = CGImageDestinationCreateWithData(
                data, UTType.png.identifier as CFString, 1, nil)
        else {
            throw NativeFailure.decodeFailed("Cannot create PNG encoder.")
        }
        CGImageDestinationAddImage(destination, rendered, nil)
        guard CGImageDestinationFinalize(destination) else {
            throw NativeFailure.decodeFailed("Cannot encode PNG frame.")
        }
        return data as Data
    }
}
