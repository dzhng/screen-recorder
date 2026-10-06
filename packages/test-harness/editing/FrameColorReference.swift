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
    static func main() async throws {
        let request = try JSONDecoder().decode(
            Request.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let asset = AVURLAsset(url: URL(fileURLWithPath: request.movie))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        generator.appliesPreferredTrackTransform = true
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { throw CocoaError(.fileReadCorruptFile) }
        let support = try await track.load(.timeRange)
        let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
        var receipts: [[String: Any]] = []
        for (index, requestedUs) in request.timesUs.enumerated() {
            var receipt: [String: Any] = ["index": index, "requestedUs": requestedUs]
            do {
                let requested = CMTime(value: requestedUs, timescale: 1_000_000)
                guard CMTimeRangeContainsTime(support, time: requested) else {
                    throw NSError(domain: "picture-reference", code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Request is outside video track support"])
                }
                let selected = try await generator.image(at: requested)
                let image = selected.image
                guard let context = CGContext(
                    data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                    bytesPerRow: image.width * 4, space: srgb,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                        | CGBitmapInfo.byteOrder32Big.rawValue)
                else { throw CocoaError(.coderInvalidValue) }
                context.interpolationQuality = .none
                context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
                guard let converted = context.makeImage() else { throw CocoaError(.coderInvalidValue) }
                let file = URL(fileURLWithPath: request.output)
                    .appendingPathComponent(String(format: "%03d.png", index))
                guard let destination = CGImageDestinationCreateWithURL(
                    file as CFURL, UTType.png.identifier as CFString, 1, nil)
                else { throw CocoaError(.fileWriteUnknown) }
                CGImageDestinationAddImage(destination, converted, nil)
                guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
                guard let encoded = CGImageSourceCreateWithURL(file as CFURL, nil),
                    let encodedImage = CGImageSourceCreateImageAtIndex(encoded, 0, nil),
                    let outputColor = encodedImage.colorSpace, let outputICC = outputColor.copyICCData()
                else { throw CocoaError(.fileReadCorruptFile) }
                receipt.merge([
                    "status": "available", "actualValue": String(selected.actualTime.value),
                    "actualTimescale": selected.actualTime.timescale,
                    "sourceProfile": image.colorSpace.map { color in
                        color.name.map { $0 as String } ?? "unnamed ICC"
                    } ?? "unknown",
                    "sourceProfileSHA256": image.colorSpace?.copyICCData().map {
                        SHA256.hash(data: $0 as Data).map { String(format: "%02x", $0) }.joined()
                    } as Any? ?? NSNull(),
                    "outputProfile": outputColor.name.map { $0 as String } ?? "unnamed ICC",
                    "outputProfileSHA256": SHA256.hash(data: outputICC as Data)
                        .map { String(format: "%02x", $0) }.joined(),
                    "width": image.width, "height": image.height, "file": file.path,
                ]) { _, value in value }
            } catch {
                receipt["status"] = "failed"
                receipt["error"] = String(describing: error)
            }
            receipts.append(receipt)
        }
        FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: receipts))
    }
}
