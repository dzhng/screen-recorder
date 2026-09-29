@preconcurrency import AVFoundation
import CryptoKit
import Foundation

@main
struct Decode {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        let track = try await asset.loadTracks(withMediaType: .video)[0]
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
            ])
        reader.add(output)
        precondition(reader.startReading())
        let selected =
            CommandLine.arguments.count > 3
            ? CommandLine.arguments[3].split(separator: ",").compactMap { Int($0) }
            : [0, 10, 20, 29]
        let expected = CommandLine.arguments.count > 4 ? Int(CommandLine.arguments[4])! : 30
        precondition(selected.count == 4 && Set(selected).count == 4)
        var index = 0
        var frames: [[String: Any]] = []
        while let sample = output.copyNextSampleBuffer() {
            if selected.contains(index) {
                let buffer = CMSampleBufferGetImageBuffer(sample)!
                CVPixelBufferLockBaseAddress(buffer, .readOnly)
                defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
                var bytes = Data()
                let base = CVPixelBufferGetBaseAddress(buffer)!
                let stride = CVPixelBufferGetBytesPerRow(buffer)
                let width = CVPixelBufferGetWidth(buffer)
                let height = CVPixelBufferGetHeight(buffer)
                for y in 0..<height {
                    bytes.append(
                        base.advanced(by: y * stride).assumingMemoryBound(to: UInt8.self),
                        count: width * 4)
                }
                let color =
                    CVBufferCopyAttachment(buffer, kCVImageBufferCGColorSpaceKey, nil)
                    as! CGColorSpace
                let icc = color.copyICCData()! as Data
                try bytes.write(to: directory.appendingPathComponent("frame-\(index).bgra"))
                try icc.write(to: directory.appendingPathComponent("frame-\(index).icc"))
                let time = CMSampleBufferGetPresentationTimeStamp(sample)
                frames.append([
                    "index": index, "width": width, "height": height,
                    "ptsValue": time.value, "ptsTimescale": time.timescale,
                    "bgraSHA256": SHA256.hash(data: bytes).map { String(format: "%02x", $0) }
                        .joined(),
                    "iccSHA256": SHA256.hash(data: icc).map { String(format: "%02x", $0) }.joined(),
                ])
            }
            index += 1
        }
        precondition(reader.status == .completed && index == expected && frames.count == 4)
        let movieHash = SHA256.hash(
            data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        ).map { String(format: "%02x", $0) }.joined()
        try JSONSerialization.data(
            withJSONObject: ["movieSHA256": movieHash, "frames": frames],
            options: [.prettyPrinted, .sortedKeys]
        )
        .write(to: directory.appendingPathComponent("frames.json"))
    }
}
