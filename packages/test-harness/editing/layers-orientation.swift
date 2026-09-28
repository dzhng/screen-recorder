@preconcurrency import AVFoundation
import Foundation

// Author an ordinary orientation tag while retaining the encoded picture samples.
@main struct LayerOrientationFixture {
    static func main() async throws {
        let input = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let source = try await input.loadTracks(withMediaType: .video)[0]
        let size = try await source.load(.naturalSize)
        let movie = AVMutableComposition()
        let track = movie.addMutableTrack(withMediaType: .video, preferredTrackID: 1)!
        try track.insertTimeRange(try await source.load(.timeRange), of: source, at: .zero)
        if CommandLine.arguments.count > 3 {
            let radians = Double(CommandLine.arguments[3])! * .pi / 180
            track.preferredTransform = CGAffineTransform(rotationAngle: radians).scaledBy(
                x: CommandLine.arguments.count > 4 ? Double(CommandLine.arguments[4])! : 1,
                y: CommandLine.arguments.count > 4 ? Double(CommandLine.arguments[4])! : 1)
        } else {
            track.preferredTransform = CGAffineTransform(
                a: 0, b: 1, c: -1, d: 0, tx: size.height, ty: 0)
        }
        let export = AVAssetExportSession(asset: movie, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
    }
}
