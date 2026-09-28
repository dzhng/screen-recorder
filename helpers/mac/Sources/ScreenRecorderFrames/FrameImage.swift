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

    /// The pixel size a visible `width`x`height` is delivered at once its long edge is bounded
    /// to `maxLongEdge`. `even` additionally snaps both edges down to the even dimensions H.264
    /// requires, which costs at most one pixel of aspect ratio.
    static func delivered(width: Int, height: Int, maxLongEdge: Int, even: Bool) -> (
        width: Int, height: Int
    ) {
        let longEdge = max(width, height)
        let scale = longEdge > maxLongEdge ? Double(maxLongEdge) / Double(longEdge) : 1
        var delivered = (
            width: max(1, Int((Double(width) * scale).rounded())),
            height: max(1, Int((Double(height) * scale).rounded()))
        )
        if even {
            delivered.width = max(2, delivered.width - delivered.width % 2)
            delivered.height = max(2, delivered.height - delivered.height % 2)
        }
        return delivered
    }

    init(
        buffer: CVPixelBuffer, transform: CGAffineTransform, overlay: FrameOverlay?,
        agedFromUs: Int64, crop: FrameCrop?, maxLongEdge: Int, evenDimensions: Bool = false
    ) throws {
        var oriented = orientedVideoImage(buffer, transform: transform)
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
        let delivered = FrameImage.delivered(
            width: sourceWidth, height: sourceHeight, maxLongEdge: maxLongEdge,
            even: evenDimensions)
        width = delivered.width
        height = delivered.height
        if width != sourceWidth || height != sourceHeight {
            image = oriented.transformed(
                by: CGAffineTransform(
                    scaleX: CGFloat(width) / visible.width, y: CGFloat(height) / visible.height))
        } else {
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

    func publishPNG(to output: NewFile, context: CIContext, maxEncodedBytes: Int) throws -> Int {
        let data = try png(context: context)
        guard data.count <= maxEncodedBytes else {
            throw NativeFailure("LIMIT_EXCEEDED", "Encoded frame exceeds the requested byte limit.")
        }
        try Task.checkCancellation()
        try output.write(data)
        try Task.checkCancellation()
        return try output.publish()
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

/// Display-coordinate orientation shared by still delivery and full-canvas rendering.
public func orientedVideoImage(_ buffer: CVPixelBuffer, transform: CGAffineTransform) -> CIImage {
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
    return oriented
}
