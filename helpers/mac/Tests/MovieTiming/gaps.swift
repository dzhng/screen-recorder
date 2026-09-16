import AVFoundation
import Foundation

/// Preserve source time while replacing two generated intervals with empty container edits.
@main struct Gaps {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let type: AVMediaType = CommandLine.arguments[3] == "audio" ? .audio : .video
        let source = try await asset.loadTracks(withMediaType: type)[0]
        let composition = AVMutableComposition()
        let target = composition.addMutableTrack(
            withMediaType: type, preferredTrackID: kCMPersistentTrackID_Invalid)!
        for (start, end) in [(0, 4), (5, 151), (153, 300)] {
            if start > 0 {
                let gapStart = start == 5 ? 4 : 151
                target.insertEmptyTimeRange(
                    CMTimeRange(
                        start: CMTime(value: Int64(gapStart), timescale: 1),
                        duration: CMTime(value: Int64(start - gapStart), timescale: 1)))
            }
            try target.insertTimeRange(
                CMTimeRange(
                    start: CMTime(value: Int64(start), timescale: 1),
                    end: CMTime(value: Int64(end), timescale: 1)), of: source,
                at: CMTime(value: Int64(start), timescale: 1))
        }
        let export = AVAssetExportSession(
            asset: composition, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: CommandLine.arguments[2]), as: .mov)
        let result = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[2]))
        let track = try await result.loadTracks(withMediaType: type)[0]
        let segments = try await track.load(.segments)
        let report = segments.map {
            [
                "empty": $0.isEmpty,
                "startUs": $0.timeMapping.target.start.seconds * 1e6,
                "durationUs": $0.timeMapping.target.duration.seconds * 1e6,
            ] as [String: Any]
        }
        print(String(data: try JSONSerialization.data(withJSONObject: report), encoding: .utf8)!)
    }
}
