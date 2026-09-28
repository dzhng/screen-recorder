@preconcurrency import AVFoundation
import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Independent display reference: AVFoundation selects an encoded movie picture, then
// CoreGraphics converts its actual embedded profile into the PNG delivery color space.
// A raw ffmpeg hstack cannot preserve different profiles on its two halves.
@main struct FrameColorReference {
    struct Request: Decodable {
        let movie: String
        let output: String
        let timesUs: [Int64]
    }
    struct Receipt: Encodable {
        let index: Int
        let requestedUs: Int64
        let actualValue: String
        let actualTimescale: Int32
        let sourceProfile: String
        let sourceProfileSHA256: String
        let outputProfile: String
        let width: Int
        let height: Int
        let file: String
    }
    static func main() async throws {
        let request = try JSONDecoder().decode(
            Request.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let generator = AVAssetImageGenerator(
            asset: AVURLAsset(url: URL(fileURLWithPath: request.movie)))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        generator.appliesPreferredTrackTransform = true
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
        var receipts: [Receipt] = []
        for (index, requestedUs) in request.timesUs.enumerated() {
            let requested = CMTime(value: requestedUs, timescale: 1_000_000)
            let selected = try await generator.image(at: requested)
            precondition(
                selected.actualTime == requested, "Reference selected a different movie picture")
            let image = selected.image
            let context = CGContext(
                data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: srgb,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                    | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.interpolationQuality = .none
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            let converted = context.makeImage()!
            let file = URL(fileURLWithPath: request.output)
                .appendingPathComponent(String(format: "%03d.png", index))
            let destination = CGImageDestinationCreateWithURL(
                file as CFURL, UTType.png.identifier as CFString, 1, nil)!
            CGImageDestinationAddImage(destination, converted, nil)
            precondition(
                CGImageDestinationFinalize(destination), "Cannot write color-managed reference")
            receipts.append(
                Receipt(
                    index: index, requestedUs: requestedUs,
                    actualValue: String(selected.actualTime.value),
                    actualTimescale: selected.actualTime.timescale,
                    sourceProfile: image.colorSpace!.name.map { $0 as String } ?? "unnamed ICC",
                    sourceProfileSHA256: SHA256.hash(
                        data: image.colorSpace!.copyICCData()! as Data
                    ).map { String(format: "%02x", $0) }.joined(),
                    outputProfile: converted.colorSpace!.name.map { $0 as String } ?? "unnamed ICC",
                    width: image.width, height: image.height, file: file.path))
        }
        FileHandle.standardOutput.write(try JSONEncoder().encode(receipts))
    }
}
