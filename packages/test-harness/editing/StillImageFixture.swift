import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// The orientation oracle reindexes decoded sRGB pixels explicitly; it never uses Core Image orientation.
@main struct StillImageFixture {
    static func main() throws {
        let directory = URL(fileURLWithPath: CommandLine.arguments[1])
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let width = 64
        let height = 40
        let color = CGColorSpace(name: CGColorSpace.sRGB)!
        var records: [[String: Any]] = []
        for kind in ["png", "jpeg"] {
            var rgba = [UInt8](repeating: 0, count: width * height * 4)
            for y in 0..<height {
                for x in 0..<width {
                    let pixel: [UInt8]
                    if x < 16 && y < 12 {
                        pixel = [255, 0, 0, 255]
                    } else if x >= 48 && y < 8 {
                        pixel = [0, 255, 0, 255]
                    } else if x >= 40 && y >= 24 {
                        pixel = [0, 0, 255, 255]
                    } else if x < 8 && y >= 20 {
                        pixel = [255, 255, 0, 255]
                    } else if x >= 24 && x < 40 && y >= 12 && y < 28 {
                        pixel = [255, 255, 255, kind == "png" ? 128 : 255]
                    } else {
                        pixel = kind == "png" ? [0, 0, 0, 0] : [24, 24, 24, 255]
                    }
                    rgba.replaceSubrange((y * width + x) * 4..<(y * width + x + 1) * 4, with: pixel)
                }
            }
            let image = CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: width * 4, space: color,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue).union(
                    .byteOrder32Big),
                provider: CGDataProvider(data: Data(rgba) as CFData)!, decode: nil,
                shouldInterpolate: false, intent: .defaultIntent)!
            for orientation in 1...8 {
                let file = directory.appendingPathComponent("\(kind)-\(orientation).\(kind)")
                let destination = CGImageDestinationCreateWithURL(
                    file as CFURL,
                    (kind == "png" ? UTType.png.identifier : UTType.jpeg.identifier) as CFString, 1,
                    nil)!
                CGImageDestinationAddImage(
                    destination, image,
                    [
                        kCGImagePropertyOrientation: orientation,
                        kCGImageDestinationLossyCompressionQuality: 1,
                    ] as CFDictionary)
                precondition(CGImageDestinationFinalize(destination))
                let source = CGImageSourceCreateWithURL(file as CFURL, nil)!
                let decoded = CGImageSourceCreateImageAtIndex(source, 0, nil)!
                let properties =
                    CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as! [CFString: Any]
                precondition(
                    (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue == orientation)
                let context = CGContext(
                    data: nil, width: width, height: height, bitsPerComponent: 8,
                    bytesPerRow: width * 4, space: color,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                        | CGBitmapInfo.byteOrder32Big.rawValue)!
                context.draw(decoded, in: CGRect(x: 0, y: 0, width: width, height: height))
                let bytes = context.data!.assumingMemoryBound(to: UInt8.self)
                let outWidth = orientation >= 5 ? height : width
                let outHeight = orientation >= 5 ? width : height
                var expected = [UInt8](repeating: 0, count: rgba.count)
                for y in 0..<height {
                    for x in 0..<width {
                        let point: (Int, Int)
                        switch orientation {
                        case 1: point = (x, y)
                        case 2: point = (width - 1 - x, y)
                        case 3: point = (width - 1 - x, height - 1 - y)
                        case 4: point = (x, height - 1 - y)
                        case 5: point = (y, x)
                        case 6: point = (height - 1 - y, x)
                        case 7: point = (height - 1 - y, width - 1 - x)
                        default: point = (y, width - 1 - x)
                        }
                        for channel in 0..<4 {
                            expected[(point.1 * outWidth + point.0) * 4 + channel] =
                                bytes[(y * width + x) * 4 + channel]
                        }
                    }
                }
                let reference = file.appendingPathExtension("reference.png")
                let referenceImage = CGImage(
                    width: outWidth, height: outHeight, bitsPerComponent: 8, bitsPerPixel: 32,
                    bytesPerRow: outWidth * 4, space: color,
                    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
                        .union(.byteOrder32Big),
                    provider: CGDataProvider(data: Data(expected) as CFData)!, decode: nil,
                    shouldInterpolate: false, intent: .defaultIntent)!
                let encoder = CGImageDestinationCreateWithURL(
                    reference as CFURL, UTType.png.identifier as CFString, 1, nil)!
                CGImageDestinationAddImage(encoder, referenceImage, nil)
                precondition(CGImageDestinationFinalize(encoder))
                try Data(expected).write(to: file.appendingPathExtension("reference.rgba"))
                records.append([
                    "path": file.path, "kind": kind, "orientation": orientation,
                    "width": width, "height": height, "orientedWidth": outWidth,
                    "orientedHeight": outHeight,
                    "reference": reference.path,
                ])
            }
        }
        let data = try JSONSerialization.data(withJSONObject: records, options: [.sortedKeys])
        FileHandle.standardOutput.write(data)
    }
}
