import AVFoundation
import Foundation

func clock(_ value: CMTime) -> [String: Any] {
    ["value": String(value.value), "timescale": value.timescale, "flags": value.flags.rawValue]
}
@main struct Probe {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let track = try await asset.loadTracks(withMediaType: .audio).first!
        let range = try await track.load(.timeRange)
        let segments = try await track.load(.segments)
        let descriptions = try await track.load(.formatDescriptions)
        let format = CMAudioFormatDescriptionGetStreamBasicDescription(descriptions.first!)!.pointee
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false,
            AVLinearPCMIsBigEndianKey: false,
        ])
        reader.add(output)
        guard reader.startReading() else { throw reader.error! }
        var pcm = Data(), frames = 0
        var first: CMTime?, end: CMTime?
        while let sample = output.copyNextSampleBuffer() {
            frames += CMSampleBufferGetNumSamples(sample)
            first = first ?? CMSampleBufferGetPresentationTimeStamp(sample)
            end = CMTimeAdd(CMSampleBufferGetPresentationTimeStamp(sample), CMSampleBufferGetDuration(sample))
            let block = CMSampleBufferGetDataBuffer(sample)!
            let size = CMBlockBufferGetDataLength(block)
            var bytes = [UInt8](repeating: 0, count: size)
            guard CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: size, destination: &bytes) == noErr else {
                throw NSError(domain: "PCM copy", code: 1)
            }
            pcm.append(contentsOf: bytes)
        }
        guard reader.status == .completed else { throw reader.error! }
        try pcm.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
        let result: [String: Any] = [
            "rate": format.mSampleRate, "channels": format.mChannelsPerFrame,
            "trackStart": clock(range.start), "trackEnd": clock(CMTimeRangeGetEnd(range)),
            "decodedFrames": frames, "decodedFirst": clock(first!), "decodedEnd": clock(end!),
            "segments": segments.map { s -> [String: Any] in
                ["empty": s.isEmpty, "targetStart": clock(s.timeMapping.target.start),
                 "targetEnd": clock(CMTimeRangeGetEnd(s.timeMapping.target)),
                 "mediaStart": clock(s.timeMapping.source.start), "mediaDuration": clock(s.timeMapping.source.duration)]
            },
        ]
        print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
    }
}
