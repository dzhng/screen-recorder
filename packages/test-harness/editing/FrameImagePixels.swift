import CoreGraphics
import CryptoKit
import Foundation
import ImageIO

// Independent PNG display oracle: apply the embedded source profile before comparing sRGB RGBA.
@main struct FrameImagePixels {
    struct Receipt: Encodable {
        let width: Int
        let height: Int
        let sourceProfile: String
        let sourceProfileSHA256: String
        let outputProfile: String
        let opaque: Bool
    }
    static func main() throws {
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        guard let input = CGImageSourceCreateWithURL(url as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(input, 0, nil),
            let color = image.colorSpace, let icc = color.copyICCData(),
            image.width > 0, image.height > 0, image.width <= 8192, image.height <= 8192
        else { throw CocoaError(.fileReadCorruptFile) }
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
        let context = CGContext(data: nil, width: image.width, height: image.height,
            bitsPerComponent: 8, bytesPerRow: image.width * 4, space: srgb,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
        context.interpolationQuality = .none
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let bytes = Data(bytes: context.data!, count: image.width * image.height * 4)
        try bytes.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .withoutOverwriting)
        let receipt = Receipt(width: image.width, height: image.height,
            sourceProfile: color.name.map { $0 as String } ?? "unnamed ICC",
            sourceProfileSHA256: SHA256.hash(data: icc as Data).map { String(format: "%02x", $0) }.joined(),
            outputProfile: srgb.name! as String,
            opaque: stride(from: 3, to: bytes.count, by: 4).allSatisfy { bytes[$0] == 255 })
        print(String(decoding: try JSONEncoder().encode(receipt), as: UTF8.self))
    }
}
