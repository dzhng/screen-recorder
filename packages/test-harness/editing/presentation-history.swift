@preconcurrency import AVFoundation
import Foundation

@main struct PresentationHistoryFixture {
    static func main() async throws {
        let movie = AVMutableComposition()
        let first = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let second = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[2]))
        let a = try await first.loadTracks(withMediaType: .video)[0]
        let b = try await second.loadTracks(withMediaType: .video)[0]
        let background = movie.addMutableTrack(withMediaType: .video, preferredTrackID: 1)!
        let selected = movie.addMutableTrack(withMediaType: .video, preferredTrackID: 2)!
        try background.insertTimeRange(
            CMTimeRange(start: .zero, duration: CMTime(value: 3, timescale: 1)), of: a,
            at: CMTime(value: 1, timescale: 1))
        try selected.insertTimeRange(
            CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 3)), of: b,
            at: CMTime(value: 2, timescale: 1))
        try selected.insertTimeRange(
            CMTimeRange(
                start: CMTime(value: 1, timescale: 3), duration: CMTime(value: 1, timescale: 3)),
            of: b, at: CMTime(value: 8, timescale: 3))
        let exporter = AVAssetExportSession(
            asset: movie, presetName: AVAssetExportPresetPassthrough)!
        try await exporter.export(to: URL(fileURLWithPath: CommandLine.arguments[3]), as: .mov)
    }
}
