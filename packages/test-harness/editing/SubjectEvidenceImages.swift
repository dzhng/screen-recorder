import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Independent display/control authoring. It never invokes Yap geometry or Vision.
@main struct SubjectEvidenceImages {
    static func main() throws {
        let a = CommandLine.arguments
        let mode = a[1], input = URL(fileURLWithPath: a[2]), output = URL(fileURLWithPath: a[3])
        let source = CGImageSourceCreateWithURL(input as CFURL, nil)!
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
        let color = CGColorSpace(name: CGColorSpace.sRGB)!
        func context(_ w: Int, _ h: Int) -> CGContext {
            let c = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                space: color, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            c.setFillColor(CGColor(gray: 0, alpha: 1)); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
            c.interpolationQuality = .high
            return c
        }
        func save(_ i: CGImage, _ url: URL, _ orientation: Int = 1) {
            let writer = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
            CGImageDestinationAddImage(writer, i, [kCGImagePropertyOrientation: orientation] as CFDictionary)
            precondition(CGImageDestinationFinalize(writer))
        }
        if mode == "controls" {
            try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
            for offset in [0, 12, 24, -280] {
                let c = context(640, 360)
                c.draw(image, in: CGRect(x: offset, y: 0, width: 640, height: 360))
                save(c.makeImage()!, output.appendingPathComponent("shift-\(offset).png"))
            }
            let multi = context(640, 360)
            for x in [0, 320] { multi.draw(image, in: CGRect(x: x, y: 180, width: 320, height: 180)) }
            save(multi.makeImage()!, output.appendingPathComponent("multiple.png"))
            save(context(640, 360).makeImage()!, output.appendingPathComponent("occluded.png"))
            // Counter-rotate raw pixels, then let metadata6 produce the original upright view.
            let rotated = context(360, 640)
            rotated.translateBy(x: 360, y: 0); rotated.rotate(by: .pi / 2)
            rotated.draw(image, in: CGRect(x: 0, y: 0, width: 640, height: 360))
            save(rotated.makeImage()!, output.appendingPathComponent("orientation6.png"), 6)
            return
        }
        let object = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[4]))) as! [String: Any]
        if mode == "overlay" {
            let c = context(image.width, image.height)
            c.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            for (key, rgb) in [("authored", [CGFloat(1),0,1]), ("detected", [CGFloat(0),1,0])] {
                c.setStrokeColor(CGColor(colorSpace: color, components: rgb + [1])!); c.setLineWidth(2)
                for box in object[key] as? [[String: Double]] ?? [] {
                    c.stroke(CGRect(x: box["x"]!, y: Double(image.height) - box["y"]! - box["height"]!, width: box["width"]!, height: box["height"]!))
                }
            }
            save(c.makeImage()!, output)
            return
        }
        precondition(mode == "reference" || mode == "reference-cg")
        let canvas = object["canvas"] as! [String: Int], geometry = object["geometry"] as! [String: Any]
        let cw = canvas["width"]!, ch = canvas["height"]!
        let c = context(cw, ch)
        let crop = geometry["crop"] as? [String: Double] ?? ["x":0,"y":0,"width":Double(image.width),"height":Double(image.height)]
        let rect = geometry["rect"] as? [String: Double] ?? ["x":0,"y":0,"width":Double(cw),"height":Double(ch)]
        var sx = rect["width"]! / crop["width"]!, sy = rect["height"]! / crop["height"]!
        if geometry["fit"] as? String != "stretch" { sx = min(sx, sy); sy = sx }
        let w = crop["width"]! * sx, h = crop["height"]! * sy
        let x = rect["x"]! + (rect["width"]! - w) / 2, y = rect["y"]! + (rect["height"]! - h) / 2
        if mode == "reference" {
            // Independent top-left crop/placement arithmetic, with the platform's declared
            // linear-light resampling. CG's encoded-space interpolation is retained separately.
            let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!, .workingFormat: CIFormat.RGBAh.rawValue, .cacheIntermediates: false])
            let cropped = CIImage(cgImage: image).cropped(to: CGRect(x: crop["x"]!, y: Double(image.height)-crop["y"]!-crop["height"]!, width: crop["width"]!, height: crop["height"]!))
            let transform = CGAffineTransform(a: sx, b: 0, c: 0, d: sy,
                tx: x-crop["x"]!*sx, ty: Double(ch)-y-h-(Double(image.height)-crop["y"]!-crop["height"]!)*sy)
            let background = CIImage(color: .black).cropped(to: CGRect(x: 0, y: 0, width: cw, height: ch))
            let result = cropped.transformed(by: transform).composited(over: background)
            save(context.createCGImage(result, from: background.extent, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.itur_709)!)!, output)
            return
        }
        c.clip(to: CGRect(x: x, y: Double(ch) - y - h, width: w, height: h))
        c.draw(image, in: CGRect(x: x - crop["x"]! * sx,
            y: Double(ch) - y - h - (Double(image.height) - crop["y"]! - crop["height"]!) * sy,
            width: Double(image.width) * sx, height: Double(image.height) * sy))
        save(c.makeImage()!, output)
    }
}
