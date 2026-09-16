@preconcurrency import AVFoundation
import Foundation

@main struct Gap {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let source = try await asset.loadTracks(withMediaType: .video).first!
        let composition = AVMutableComposition()
        let track = composition.addMutableTrack(
            withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        try track.insertTimeRange(
            CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 30)), of: source,
            at: .zero)
        track.insertEmptyTimeRange(
            CMTimeRange(
                start: CMTime(value: 1, timescale: 30), duration: CMTime(value: 1, timescale: 10)))
        try track.insertTimeRange(
            CMTimeRange(
                start: CMTime(value: 1, timescale: 30), duration: CMTime(value: 5, timescale: 30)),
            of: source, at: CMTime(value: 4, timescale: 30))
        let export = AVAssetExportSession(
            asset: composition, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
    }
}
