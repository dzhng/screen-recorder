@preconcurrency import AVFoundation
import Foundation

/// Retained video with a container offset and a physical empty edit; never activates capture.
@main struct CaptureVideoFixture {
    static func main() async throws {
        let source = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let video = try await source.loadTracks(withMediaType: .video).first!
        let composition = AVMutableComposition()
        let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: 1)!
        track.insertEmptyTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 4)))
        try track.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 1)),
            of: video, at: CMTime(value: 1, timescale: 4))
        track.insertEmptyTimeRange(CMTimeRange(start: CMTime(value: 5, timescale: 4), duration: CMTime(value: 1, timescale: 2)))
        try track.insertTimeRange(CMTimeRange(start: CMTime(value: 1, timescale: 1), duration: CMTime(value: 1, timescale: 1)),
            of: video, at: CMTime(value: 7, timescale: 4))
        let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
    }
}
