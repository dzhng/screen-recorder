import AVFoundation
import Foundation

/// Independent AVFoundation decoder ledger; writes decoded audio incrementally for comparison.
@main struct MovieTiming {
    @MainActor static func main() async throws {
        let url = URL(fileURLWithPath: CommandLine.arguments[1])
        let raw = URL(fileURLWithPath: CommandLine.arguments[2])
        FileManager.default.createFile(atPath: raw.path, contents: nil)
        let file = try FileHandle(forWritingTo: raw)
        defer { try? file.close() }
        let asset = AVURLAsset(url: url)
        var tracks: [[String: Any]] = []
        for track in try await asset.load(.tracks) {
            let range = try await track.load(.timeRange)
            let segments = try await track.load(.segments)
            var ledger: [String: Any] = [
                "type": track.mediaType.rawValue,
                "startUs": range.start.seconds * 1e6,
                "durationUs": range.duration.seconds * 1e6,
                "segments": segments.map {
                    [
                        "empty": $0.isEmpty,
                        "sourceStartUs": $0.timeMapping.source.start.seconds * 1e6,
                        "targetStartUs": $0.timeMapping.target.start.seconds * 1e6,
                        "durationUs": $0.timeMapping.target.duration.seconds * 1e6,
                    ]
                },
            ]
            if track.mediaType == .audio {
                let reader = try AVAssetReader(asset: asset)
                let output = AVAssetReaderTrackOutput(
                    track: track,
                    outputSettings: [
                        AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMIsFloatKey: true,
                        AVLinearPCMBitDepthKey: 32, AVLinearPCMIsNonInterleaved: false,
                    ])
                reader.add(output)
                guard reader.startReading() else { throw reader.error! }
                var frames = 0
                var first = Double.nan
                var end = 0.0
                while let sample = output.copyNextSampleBuffer() {
                    let at = CMSampleBufferGetPresentationTimeStamp(sample).seconds
                    if frames == 0 { first = at }
                    frames += CMSampleBufferGetNumSamples(sample)
                    end = at + CMSampleBufferGetDuration(sample).seconds
                    let data = CMSampleBufferGetDataBuffer(sample)!
                    var bytes = Data(count: CMBlockBufferGetDataLength(data))
                    let status = bytes.withUnsafeMutableBytes {
                        CMBlockBufferCopyDataBytes(
                            data, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!)
                    }
                    guard status == noErr else { fatalError("Cannot copy decoded PCM") }
                    try file.write(contentsOf: bytes)
                }
                guard reader.status == .completed else { throw reader.error! }
                ledger["decodedFrames"] = frames
                ledger["decodedStartUs"] = first * 1e6
                ledger["decodedEndUs"] = end * 1e6
            }
            tracks.append(ledger)
        }
        var report: [String: Any] = [
            "durationUs": try await asset.load(.duration).seconds * 1e6,
            "tracks": tracks,
        ]
        if CommandLine.arguments.contains("--play") {
            let item = AVPlayerItem(asset: asset)
            let player = AVPlayer(playerItem: item)
            player.isMuted = true
            let ended = EndState()
            let token = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
            ) { _ in Task { @MainActor in ended.value = true } }
            defer {
                NotificationCenter.default.removeObserver(token)
                player.pause()
            }
            let deadline = ContinuousClock.now.advanced(by: .seconds(15))
            player.play()
            while !ended.value && ContinuousClock.now < deadline {
                if item.status == .failed { throw item.error! }
                try await Task.sleep(for: .milliseconds(1))
            }
            guard ended.value else { fatalError("Owned generated playback did not reach end") }
            report["playerEndUs"] = player.currentTime().seconds * 1e6
            report["playerEndedNotification"] = true
        }
        print(
            String(
                data: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]),
                encoding: .utf8)!)
    }
}

@MainActor private final class EndState { var value = false }
