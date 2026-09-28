@preconcurrency import AVFoundation
import Foundation

// Independent AVFoundation reader: count the whole source, retain only its final two seconds.
// No ScreenRecorderAudio code or generated output is used as the expected PCM.
@main struct AudioExtractionReference {
    static func main() async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
        let track = try await asset.loadTracks(withMediaType: .audio)[0]
        let range = try await track.load(.timeRange)
        let expected = CMTimeConvertScale(range.duration, timescale: 48000,
            method: .roundTowardZero).value
        let tailStart = expected - 96000
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000,
            AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false,
        ])
        reader.add(output)
        precondition(reader.startReading())
        let destination = CommandLine.arguments[2]
        precondition(FileManager.default.createFile(atPath: destination, contents: nil))
        let file = try FileHandle(forWritingTo: URL(fileURLWithPath: destination))
        defer { try? file.close() }
        var frames: Int64 = 0
        var tailFrames: Int64 = 0
        while let sample = autoreleasepool(invoking: { output.copyNextSampleBuffer() }) {
            let count = CMSampleBufferGetNumSamples(sample)
            if count == 0 { continue }
            let stamp = CMTimeConvertScale(CMSampleBufferGetPresentationTimeStamp(sample),
                timescale: 48000, method: .roundTowardZero).value
            precondition(stamp == frames, "Independent source decode is not contiguous")
            var list = AudioBufferList()
            var block: CMBlockBuffer?
            precondition(CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sample,
                bufferListSizeNeededOut: nil, bufferListOut: &list,
                bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
                blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block) == noErr)
            let skip = Int(min(Int64(count), max(0, tailStart - frames)))
            if skip < count {
                try file.write(contentsOf: Data(bytes: list.mBuffers.mData!.advanced(by: skip * 8),
                    count: (count - skip) * 8))
                tailFrames += Int64(count - skip)
            }
            frames += Int64(count)
        }
        precondition(reader.status == .completed && frames == expected && tailFrames == 96000)
        print("{\"frames\":\(frames),\"tailStartFrame\":\(tailStart),\"tailFrames\":\(tailFrames)}")
    }
}
