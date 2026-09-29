@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Independent sequential decode: preserve every frame, its actual clock and embedded color profile.
@main struct EncodedAppearanceFrames {
    static func main() async throws {
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let asset = AVURLAsset(url: url)
        let track = try await asset.loadTracks(withMediaType: .video)[0]
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ])
        reader.add(output)
        precondition(reader.startReading())
        var frames: [[String: Any]] = []
        while let sample = output.copyNextSampleBuffer() {
            precondition(frames.count < 1000, "Bounded verification cohort exceeded")
            let pixel = CMSampleBufferGetImageBuffer(sample)!
            CVPixelBufferLockBaseAddress(pixel, .readOnly)
            defer { CVPixelBufferUnlockBaseAddress(pixel, .readOnly) }
            let width = CVPixelBufferGetWidth(pixel), height = CVPixelBufferGetHeight(pixel)
            let stride = CVPixelBufferGetBytesPerRow(pixel)
            var bytes = Data()
            for y in 0..<height {
                bytes.append(CVPixelBufferGetBaseAddress(pixel)!.advanced(by: y * stride)
                    .assumingMemoryBound(to: UInt8.self), count: width * 4)
            }
            let color = CVBufferCopyAttachment(pixel, kCVImageBufferCGColorSpaceKey, nil) as! CGColorSpace
            let icc = color.copyICCData()! as Data
            let digest = { (data: Data) in SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
            let iccHash = digest(icc)
            let iccURL = directory.appendingPathComponent(iccHash + ".icc")
            if !FileManager.default.fileExists(atPath: iccURL.path) { try icc.write(to: iccURL) }
            let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: width * 4, space: color,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue),
                provider: CGDataProvider(data: bytes as CFData)!, decode: nil,
                shouldInterpolate: false, intent: .defaultIntent)!
            let file = String(format: "%04d.png", frames.count)
            let destination = CGImageDestinationCreateWithURL(directory.appendingPathComponent(file) as CFURL,
                UTType.png.identifier as CFString, 1, nil)!
            CGImageDestinationAddImage(destination, image, nil)
            precondition(CGImageDestinationFinalize(destination))
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            let duration = CMSampleBufferGetDuration(sample)
            frames.append(["index": frames.count, "file": file, "width": width, "height": height,
                "pts": ["value": String(pts.value), "timescale": pts.timescale],
                "duration": ["value": String(duration.value), "timescale": duration.timescale, "valid": duration.isValid],
                "bgraSHA256": digest(bytes), "iccSHA256": iccHash])
        }
        precondition(reader.status == .completed)
        let report: [String: Any] = ["movieSHA256": SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined(), "frames": frames]
        try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            .write(to: directory.appendingPathComponent("frames.json"))
    }
}
