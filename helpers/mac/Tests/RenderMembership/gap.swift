@preconcurrency import AVFoundation
import Foundation

@main struct Gap {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let source = try await asset.loadTracks(withMediaType: .video).first!
        let composition = AVMutableComposition()
        let track = composition.addMutableTrack(
            withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        // Long gaps let the playback probe distinguish an empty edit from a brief
        // decoder transition. The original short fixture remains unchanged.
        if CommandLine.arguments.count == 4 {
            guard ["leading", "internal"].contains(CommandLine.arguments[3]) else {
                throw NSError(domain: "GapProbe", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Expected leading or internal gap"])
            }
            let leading = CommandLine.arguments[3] == "leading"
            let second = CMTime(value: 1, timescale: 1)
            let gapStart: CMTime = leading ? .zero : second
            if !leading {
                try track.insertTimeRange(CMTimeRange(start: .zero, duration: second),
                                          of: source, at: .zero)
            }
            track.insertEmptyTimeRange(CMTimeRange(start: gapStart,
                                                   duration: CMTime(value: 2, timescale: 1)))
            try track.insertTimeRange(CMTimeRange(start: second, duration: second),
                                      of: source,
                                      at: CMTimeAdd(gapStart, CMTime(value: 2, timescale: 1)))
            let export = AVAssetExportSession(asset: composition,
                                              presetName: AVAssetExportPresetPassthrough)!
            try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
            return
        }
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
