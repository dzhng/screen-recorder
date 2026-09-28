@preconcurrency import AVFoundation
import Foundation

/// Two distinguishable parts of the retained real narration, with the same container clock.
@main struct SelectedAudioFixture {
    static func main() async throws {
        let source = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let audio = try await source.loadTracks(withMediaType: .audio).first!
        let folder = URL(fileURLWithPath: CommandLine.arguments[2])
        for (name, selections) in [("multi", [0, 50]), ("first", [0]), ("second", [50])] {
            let composition = AVMutableComposition()
            for (index, selection) in selections.enumerated() {
                let track = composition.addMutableTrack(withMediaType: .audio,
                    preferredTrackID: CMPersistentTrackID(index + 1))!
                track.insertEmptyTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 1, timescale: 4)))
                try track.insertTimeRange(CMTimeRange(start: CMTime(value: Int64(selection), timescale: 1),
                    duration: CMTime(value: 6, timescale: 1)), of: audio, at: CMTime(value: 1, timescale: 4))
                track.insertEmptyTimeRange(CMTimeRange(start: CMTime(value: 25, timescale: 4),
                    duration: CMTime(value: 1, timescale: 2)))
                try track.insertTimeRange(CMTimeRange(start: CMTime(value: Int64(selection + 6), timescale: 1),
                    duration: CMTime(value: 6, timescale: 1)), of: audio, at: CMTime(value: 27, timescale: 4))
            }
            let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
            try await export.export(to: folder.appendingPathComponent(name + ".mov"), as: .mov)
        }
    }
}
