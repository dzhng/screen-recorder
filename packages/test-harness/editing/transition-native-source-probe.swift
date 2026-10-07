@preconcurrency import AVFoundation
import CryptoKit
import Foundation

private struct Transform: Encodable {
    let a: Double
    let b: Double
    let c: Double
    let d: Double
    let tx: Double
    let ty: Double
}

private struct Frame: Encodable {
    let index: Int
    let width: Int
    let height: Int
    let ptsValue: Int64
    let ptsTimescale: Int32
    let bgraSHA256: String
}

private struct Receipt: Encodable {
    let sourceSHA256: String
    let transform: Transform
    let frames: [Frame]
}

private func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

@main
struct Probe {
    static func main() async throws {
        guard CommandLine.arguments.count == 3 else {
            throw NSError(domain: "transition-native-source-probe", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Usage: probe SOURCE OUTPUT"])
        }
        let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)
        let asset = AVURLAsset(url: sourceURL)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { throw NSError(domain: "probe", code: 2) }
        let transform = try await track.load(.preferredTransform)
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? NSError(domain: "probe", code: 3) }
        var frames: [Frame] = []
        var index = 0
        while let sample = output.copyNextSampleBuffer() {
            guard let buffer = CMSampleBufferGetImageBuffer(sample) else {
                throw NSError(domain: "probe", code: 4)
            }
            CVPixelBufferLockBaseAddress(buffer, .readOnly)
            defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
            guard let base = CVPixelBufferGetBaseAddress(buffer) else {
                throw NSError(domain: "probe", code: 5)
            }
            let width = CVPixelBufferGetWidth(buffer)
            let height = CVPixelBufferGetHeight(buffer)
            let stride = CVPixelBufferGetBytesPerRow(buffer)
            var bytes = Data(capacity: width * height * 4)
            for y in 0..<height {
                bytes.append(base.advanced(by: y * stride).assumingMemoryBound(to: UInt8.self), count: width * 4)
            }
            try bytes.write(to: outputURL.appendingPathComponent("frame-\(index).bgra"))
            let time = CMSampleBufferGetPresentationTimeStamp(sample)
            frames.append(Frame(index: index, width: width, height: height,
                                ptsValue: time.value, ptsTimescale: time.timescale,
                                bgraSHA256: sha256(bytes)))
            index += 1
        }
        guard reader.status == .completed else { throw reader.error ?? NSError(domain: "probe", code: 6) }
        let report = Receipt(
            sourceSHA256: sha256(try Data(contentsOf: sourceURL)),
            transform: Transform(a: transform.a, b: transform.b, c: transform.c, d: transform.d,
                                 tx: transform.tx, ty: transform.ty),
            frames: frames)
        let encoded = try JSONEncoder().encode(report)
        try encoded.write(to: outputURL.appendingPathComponent("frames.json"))
    }
}
