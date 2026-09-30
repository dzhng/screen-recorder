import Foundation
import ScreenRecorderMedia
import ScreenRecorderStretch

extension CompositionAudio {
    /// Request-local identity for the fixed mono preserve recipe. Native origin disambiguates
    /// physical source segments; project boundaries preserve the compiler's sample clock.
    struct RetimeKey: Hashable {
        let assetId: String
        let streamId: String
        let sampleRate: Int
        let originNumerator: Int128
        let originDenominator: Int128
        let sourceStart: Int64
        let sourceEnd: Int64
        let inputFrames: Int64
        let projectStart: Int64
        let projectEnd: Int64
        init(assetId: String, streamId: String, source: SourceTrack, context: Context) {
            self.assetId = assetId; self.streamId = streamId
            sampleRate = source.sampleRate
            originNumerator = context.origin.numerator; originDenominator = context.origin.denominator
            sourceStart = context.sourceStart; sourceEnd = context.sourceEnd
            inputFrames = context.inputFrames
            projectStart = context.project.start; projectEnd = context.project.end
        }
    }

    final class PreparedRetime {
        let range: Plan.Samples
        let directory: URL
        let output: FileHandle
        init(source: SourceTrack, context: Context, parent: URL, sources: Sources) throws {
            range = context.project
            let count = range.end - range.start
            guard context.inputFrames > 0, context.inputFrames <= Int32.max,
                count > 0, count <= Int32.max else {
                throw NativeFailure("NOT_READY", "Retained retiming exceeds the exact file adapter's sample capacity.")
            }
            directory = parent.appendingPathComponent(".retime-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
            do {
                let inputURL = directory.appendingPathComponent("input.f32")
                let outputURL = directory.appendingPathComponent("output.f32")
                guard FileManager.default.createFile(atPath: inputURL.path, contents: nil),
                    FileManager.default.createFile(atPath: outputURL.path, contents: nil) else {
                    throw invalid("Cannot create retiming scratch files.")
                }
                let input = try FileHandle(forUpdating: inputURL)
                defer { try? input.close() }
                output = try FileHandle(forUpdating: outputURL)
                let decoder = AudioSourceReader(input: source.input, asset: source.asset, track: source.track,
                    sampleRate: source.sampleRate, packetFrames: source.packetFrames, channels: source.channels)
                defer { sources.record(frames: decoder.decodedFrames, rate: source.sampleRate, channels: source.channels) }
                let conversion = try ConvertedAudioInterval(source: source, decoder: decoder,
                    origin: context.origin, start: context.sourceStart, outputRate: rate,
                    owed: context.inputFrames, support: .finite(end: context.sourceEnd))
                var position: Int64 = 0
                while position < context.inputFrames {
                    try Task.checkCancellation()
                    try autoreleasepool {
                        let count = Int(min(8192, context.inputFrames - position))
                        var samples = [Float](repeating: 0, count: count)
                        try conversion.mix(into: &samples, at: 0, frames: count, gain: 1, channelMap: [0])
                        try samples.withUnsafeBytes { try input.write(contentsOf: $0) }
                        position += Int64(count)
                    }
                }
                try SignalsmithProcessor.processFile(inputFD: input.fileDescriptor, firstFrame: 0,
                    inputFrames: Int(context.inputFrames), outputFD: output.fileDescriptor,
                    outputFrames: Int(count), sampleRate: rate, channels: 1,
                    checkCancellation: { try Task.checkCancellation() })
                guard try output.seekToEnd() == UInt64(count) * 4 else {
                    throw invalid("Prepared retiming sample count differs from retained run.")
                }
                try FileManager.default.removeItem(at: inputURL)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                throw error
            }
        }
        deinit {
            try? output.close()
            try? FileManager.default.removeItem(at: directory)
        }
        func mix(into samples: inout [Float], at destination: Int, position: Int64, count: Int) throws {
            try autoreleasepool {
                guard position >= range.start, position + Int64(count) <= range.end else {
                    throw invalid("Retimed PCM read exceeds retained run.")
                }
                try output.seek(toOffset: UInt64(position - range.start) * 4)
                let data = try output.read(upToCount: count * 4) ?? Data()
                guard data.count == count * 4 else { throw invalid("Prepared retiming PCM is truncated.") }
                data.withUnsafeBytes { bytes in
                    for frame in 0..<count {
                        let sample = bytes.loadUnaligned(fromByteOffset: frame * 4, as: Float.self)
                        samples[(destination + frame) * 2] += sample
                        samples[(destination + frame) * 2 + 1] += sample
                    }
                }
            }
        }
    }
}
