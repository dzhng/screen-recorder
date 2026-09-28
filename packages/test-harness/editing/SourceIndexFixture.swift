@preconcurrency import AVFoundation
import Foundation

/// Native edit metadata for an unsampled island or two distinct temporal pictures.
@main struct SourceIndexFixture {
    static func main() async throws {
        let input = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let source = try await input.loadTracks(withMediaType: .video)[0]
        let movie = AVMutableComposition()
        let anchor = movie.addMutableTrack(withMediaType: .video, preferredTrackID: 1)!
        if CommandLine.arguments.count == 4 {
            let secondInput = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[3]))
            let second = try await secondInput.loadTracks(withMediaType: .video)[0]
            try anchor.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 4, timescale: 10)), of: source, at: CMTime(value: 125, timescale: 100))
            try anchor.insertTimeRange(CMTimeRange(start: CMTime(value: 6, timescale: 10), duration: CMTime(value: 4, timescale: 10)), of: second, at: CMTime(value: 185, timescale: 100))
        } else {
            try anchor.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 1)), of: source, at: CMTime(value: 125, timescale: 100))
            let island = movie.addMutableTrack(withMediaType: .video, preferredTrackID: 2)!
            try island.insertTimeRange(CMTimeRange(start: CMTime(value: 1, timescale: 10), duration: CMTime(value: 5, timescale: 100)), of: source, at: CMTime(value: 130, timescale: 100))
            try island.insertTimeRange(CMTimeRange(start: CMTime(value: 6, timescale: 10), duration: CMTime(value: 2, timescale: 10)), of: source, at: CMTime(value: 185, timescale: 100))
        }
        let writer = AVAssetExportSession(asset: movie, presetName: AVAssetExportPresetPassthrough)!
        try await writer.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
    }
}
