@preconcurrency import AVFoundation
import Foundation

@main struct SourceFrameFixture {
    static func main() async throws {
        let movie = AVMutableComposition()
        for path in CommandLine.arguments[1...2] {
            let asset = AVURLAsset(url: URL(fileURLWithPath: path))
            let source = try await asset.loadTracks(withMediaType: .video)[0]
            let target = movie.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
            try target.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 4, timescale: 10)),
                of: source, at: CMTime(value: 125, timescale: 100))
            try target.insertTimeRange(CMTimeRange(start: CMTime(value: 6, timescale: 10), duration: CMTime(value: 4, timescale: 10)),
                of: source, at: CMTime(value: 185, timescale: 100))
        }
        let writer = AVAssetExportSession(asset: movie, presetName: AVAssetExportPresetPassthrough)!
        try await writer.export(to: URL(fileURLWithPath: CommandLine.arguments[3]), as: .mov)
    }
}
