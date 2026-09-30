import Foundation
import ScreenRecorderMedia
import ScreenRecorderStretch

extension CompositionAudio {
    /// Native origin disambiguates physical source segments. Policy and exact playback
    /// rate distinguish recipes even when they quantize to identical project boundaries.
    struct RetimeKey: Hashable {
        let assetId: String
        let streamId: String
        let sampleRate: Int
        let pitch: String
        let rateNumerator: Int128
        let rateDenominator: Int128
        let originNumerator: Int128
        let originDenominator: Int128
        let sourceStart: Int64
        let sourceEnd: Int64
        let inputFrames: Int64
        let projectStart: Int64
        let projectEnd: Int64
        init(assetId: String, streamId: String, source: SourceTrack, context: Context, pitch: String) {
            self.assetId = assetId; self.streamId = streamId
            self.pitch = pitch
            rateNumerator = context.playbackRate.numerator; rateDenominator = context.playbackRate.denominator
            sampleRate = source.sampleRate
            originNumerator = context.origin.numerator; originDenominator = context.origin.denominator
            sourceStart = context.sourceStart; sourceEnd = context.sourceEnd
            inputFrames = context.inputFrames
            projectStart = context.project.start; projectEnd = context.project.end
        }
    }

    final class PreparedRetime {
        let range: Plan.Samples
        let channels: Int
        let directory: URL
        let outputURL: URL
        init(source: SourceTrack, context: Context, pitch: String, parent: URL, sources: Sources) throws {
            range = context.project
            channels = source.channels
            let count = range.end - range.start
            if pitch == "preserve" {
                guard context.inputFrames > 0, context.inputFrames <= Int32.max,
                    count > 0, count <= Int32.max else {
                    throw NativeFailure("NOT_READY", "Retained retiming exceeds the exact file adapter's sample capacity.")
                }
            }
            directory = parent.appendingPathComponent(".retime-\(UUID().uuidString)", isDirectory: true)
            outputURL = directory.appendingPathComponent("output.f32")
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
            do {
                guard FileManager.default.createFile(atPath: outputURL.path, contents: nil) else {
                    throw invalid("Cannot create retiming scratch file.")
                }
                let output = try FileHandle(forUpdating: outputURL)
                defer { try? output.close() }
                let decoder = AudioSourceReader(input: source.input, asset: source.asset, track: source.track,
                    sampleRate: source.sampleRate, packetFrames: source.packetFrames, channels: source.channels)
                defer { sources.record(frames: decoder.decodedFrames, rate: source.sampleRate, channels: source.channels) }
                func render(to file: FileHandle, frames: Int64, playbackRate: ExactTime) throws {
                    let conversion = try ConvertedAudioInterval(source: source, decoder: decoder,
                        origin: context.origin, start: context.sourceStart, outputRate: rate,
                        owed: frames, support: .finite(end: context.sourceEnd), playbackRate: playbackRate)
                    var position: Int64 = 0
                    while position < frames {
                        try Task.checkCancellation()
                        try autoreleasepool {
                            let count = Int(min(8192, frames - position))
                            var samples = [Float](repeating: 0, count: count * source.channels)
                            try conversion.mix(into: &samples, at: 0, frames: count, gain: 1,
                                channelMap: Array(0..<source.channels))
                            guard samples.allSatisfy(\.isFinite) else { throw invalid("Retiming conversion produced non-finite samples.") }
                            try samples.withUnsafeBytes { try file.write(contentsOf: $0) }
                            position += Int64(count)
                        }
                    }
                }
                if pitch == "follow" {
                    try render(to: output, frames: count, playbackRate: context.playbackRate)
                } else {
                    let inputURL = directory.appendingPathComponent("input.f32")
                    guard FileManager.default.createFile(atPath: inputURL.path, contents: nil) else {
                        throw invalid("Cannot create retiming input scratch file.")
                    }
                    let input = try FileHandle(forUpdating: inputURL)
                    defer { try? input.close() }
                    try render(to: input, frames: context.inputFrames, playbackRate: ExactTime(1))
                    try SignalsmithProcessor.processFile(inputFD: input.fileDescriptor, firstFrame: 0,
                        inputFrames: Int(context.inputFrames), outputFD: output.fileDescriptor,
                        outputFrames: Int(count), sampleRate: rate, channels: source.channels,
                        checkCancellation: { try Task.checkCancellation() })
                    try FileManager.default.removeItem(at: inputURL)
                }
                guard try output.seekToEnd() == UInt64(count) * UInt64(source.channels) * 4 else {
                    throw invalid("Prepared retiming sample count differs from retained run.")
                }
            } catch {
                try? FileManager.default.removeItem(at: directory)
                throw error
            }
        }
        deinit {
            try? FileManager.default.removeItem(at: directory)
        }
        func mix(into samples: inout [Float], at destination: Int, position: Int64, count: Int) throws {
            try autoreleasepool {
                guard position >= range.start, position + Int64(count) <= range.end else {
                    throw invalid("Retimed PCM read exceeds retained run.")
                }
                // Completed runs own paths, not descriptors: thousands of retained runs
                // must not exhaust the process's file limit before playback starts.
                let output = try FileHandle(forReadingFrom: outputURL)
                defer { try? output.close() }
                try output.seek(toOffset: UInt64(position - range.start) * UInt64(channels) * 4)
                let data = try output.read(upToCount: count * channels * 4) ?? Data()
                guard data.count == count * channels * 4 else { throw invalid("Prepared retiming PCM is truncated.") }
                data.withUnsafeBytes { bytes in
                    for frame in 0..<count {
                        for channel in 0..<2 {
                            let sourceChannel = channels == 1 ? 0 : channel
                            let sample = bytes.loadUnaligned(fromByteOffset: (frame * channels + sourceChannel) * 4, as: Float.self)
                            samples[(destination + frame) * 2 + channel] += sample
                        }
                    }
                }
            }
        }
    }
}
