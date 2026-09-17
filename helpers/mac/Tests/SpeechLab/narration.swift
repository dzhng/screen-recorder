@preconcurrency import AVFoundation
import Foundation

/// Assembles a narration movie from audio pieces and empty edits:
/// `narration OUTPUT.mov PIECE...`, where a piece is an audio file path or `gap:SECONDS`. Each
/// empty edit is time the file covers without holding a sample, like a capture that lost its input.
@main struct Narration {
    static func main() async throws {
        let arguments = CommandLine.arguments.dropFirst()
        let composition = AVMutableComposition()
        let track = composition.addMutableTrack(
            withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
        var cursor = CMTime.zero
        for piece in arguments.dropFirst() {
            if piece.hasPrefix("gap:") {
                let duration = CMTime(seconds: Double(piece.dropFirst(4))!, preferredTimescale: 48_000)
                track.insertEmptyTimeRange(CMTimeRange(start: cursor, duration: duration))
                cursor = CMTimeAdd(cursor, duration)
                continue
            }
            let asset = AVURLAsset(url: URL(fileURLWithPath: piece))
            let audio = try await asset.loadTracks(withMediaType: .audio).first!
            let range = try await audio.load(.timeRange)
            try track.insertTimeRange(range, of: audio, at: cursor)
            cursor = CMTimeAdd(cursor, range.duration)
        }
        let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: URL(fileURLWithPath: arguments.first!), as: .mov)
    }
}
