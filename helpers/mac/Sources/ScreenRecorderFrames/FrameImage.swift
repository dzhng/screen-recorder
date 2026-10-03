import CoreImage
import CoreVideo
import Foundation
import ImageIO
import ScreenRecorderMedia
import UniformTypeIdentifiers

/// Shared orientation, delivery sizing and lossless encoding for source and compiled pictures.
/// Composition geometry and pointer drawing belong to CompositionPictureExecutor.
struct FrameImage {
    let image: CIImage
    let width: Int
    let height: Int

    /// The pixel size a visible `width`x`height` is delivered at once its long edge is bounded
    /// to `maxLongEdge`. Movie dimensions are authored and validated by their output settings.
    static func delivered(width: Int, height: Int, maxLongEdge: Int) -> (
        width: Int, height: Int
    ) {
        let longEdge = max(width, height)
        let scale = longEdge > maxLongEdge ? Double(maxLongEdge) / Double(longEdge) : 1
        let delivered = (
            width: max(1, Int((Double(width) * scale).rounded())),
            height: max(1, Int((Double(height) * scale).rounded()))
        )
        return delivered
    }

    init(buffer: CVPixelBuffer, transform: CGAffineTransform, maxLongEdge: Int) throws {
        let oriented = orientedVideoImage(buffer, transform: transform)
        guard max(Int(oriented.extent.width.rounded()), Int(oriented.extent.height.rounded())) > 0 else {
            throw NativeFailure.decodeFailed("Decoded sample has no pixels.")
        }
        self.init(oriented: oriented, maxLongEdge: maxLongEdge)
    }

    /// Timeless ImageIO sources and video samples share delivery sizing and lossless PNG publication.
    init(oriented: CIImage, maxLongEdge: Int) {
        let visible = oriented.extent
        let delivered = FrameImage.delivered(
            width: Int(visible.width.rounded()), height: Int(visible.height.rounded()),
            maxLongEdge: maxLongEdge)
        width = delivered.width
        height = delivered.height
        if width != Int(visible.width.rounded()) || height != Int(visible.height.rounded()) {
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
        try publishPNGData(png(context: context), to: output, maxEncodedBytes: maxEncodedBytes)
    }

    func png(context: CIContext) throws -> Data {
        try encodePNG(renderedImage(context: context))
    }

    func renderedImage(context: CIContext) throws -> CGImage {
        guard
            let rendered = context.createCGImage(
                image, from: CGRect(x: 0, y: 0, width: width, height: height))
        else {
            throw NativeFailure.decodeFailed("Cannot render \(width)x\(height) frame.")
        }
        return rendered
    }
}

/// Shared lossless encoder for pictures and measured acoustic plots.
func encodePNG(_ rendered: CGImage) throws -> Data {
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

func publishPNGData(_ data: Data, to output: NewFile, maxEncodedBytes: Int) throws -> Int {
    guard data.count <= maxEncodedBytes else {
        throw NativeFailure("LIMIT_EXCEEDED", "Encoded image exceeds the requested byte limit.")
    }
    try Task.checkCancellation()
    try output.write(data)
    try Task.checkCancellation()
    return try output.publish()
}
