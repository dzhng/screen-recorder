@preconcurrency import AVFoundation
import Foundation

@main struct SourceFrameFixture {
    static func main() async throws {
        precondition((3...5).contains(CommandLine.arguments.count))
        let movie = AVMutableComposition()
        let outputIndex = min(3, CommandLine.arguments.count - 1)
        let gapUs = CommandLine.arguments.count > 4 ? Int64(CommandLine.arguments[4])! : 200_000
        for path in CommandLine.arguments[1..<outputIndex] {
            let asset = AVURLAsset(url: URL(fileURLWithPath: path))
            let source = try await asset.loadTracks(withMediaType: .video)[0]
            let target = movie.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
            try target.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 4, timescale: 10)),
                of: source, at: CMTime(value: 125, timescale: 100))
            try target.insertTimeRange(CMTimeRange(start: CMTime(value: 6, timescale: 10), duration: CMTime(value: 4, timescale: 10)),
                of: source, at: CMTime(value: 1_650_000 + gapUs, timescale: 1_000_000))
        }
        let writer = AVAssetExportSession(asset: movie, presetName: AVAssetExportPresetPassthrough)!
        try await writer.export(to: URL(fileURLWithPath: CommandLine.arguments[outputIndex]), as: .mov)
    }
}
