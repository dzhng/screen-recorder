@preconcurrency import AVFoundation
import Foundation

// Acquisition members require exactly one audio stream. Preserve the source edit list and clock.
@main struct AudioExtractionSelection {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let duration = try await asset.load(.duration)
        let composition = AVMutableComposition()
        try await composition.insertTimeRange(
            CMTimeRange(start: .zero, duration: duration), of: asset, at: .zero)
        let tracks = try await composition.loadTracks(withMediaType: .audio)
        for track in tracks.dropFirst() { composition.removeTrack(track) }
        let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
    }
}
