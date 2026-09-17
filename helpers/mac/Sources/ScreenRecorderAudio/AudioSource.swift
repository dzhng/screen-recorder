@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

/// One planned source file, opened once. `available` states, in recording source time, where this
/// excerpt may read: where the caller's acquisition evidence and the file's own occupied edit-list
/// segments, shifted by the plan's offset, agree.
struct SourceTrack {
    let plan: AudioTrackPlan
    let url: URL
    let input: MediaInput
    let asset: AVURLAsset
    let track: AVAssetTrack
    let sampleRate: Int
    let channels: Int
    let available: [TimeSpan]

    static func open(plan: AudioTrackPlan) async throws -> SourceTrack {
        let source = URL(fileURLWithPath: plan.source)
        guard FileManager.default.fileExists(atPath: source.path) else {
            throw NativeFailure.decodeFailed("No source media at \(source.path).")
        }
        let input = try MediaInput(url: source)
        let asset = input.asset
        let audio: AVAssetTrack
        let stream: AudioStreamBasicDescription
        let segments: [SourceSegment]
        do {
            guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
                throw NativeFailure.decodeFailed("Source has no audio track: \(source.path).")
            }
            guard let description = try await track.load(.formatDescriptions).first,
                let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee
            else {
                throw NativeFailure.decodeFailed("Source audio format is unreadable: \(source.path).")
            }
            audio = track
            stream = basic
            segments = SourceSegment.occupied(of: try await track.load(.segments))
        } catch let failure as NativeFailure {
            if let detail = input.failure { throw detail }
            throw failure
        } catch {
            if let detail = input.failure { throw detail }
            throw NativeFailure.decodeFailed("Cannot open \(source.path): \(error.localizedDescription)")
        }
        let sampleRate = Int(stream.mSampleRate.rounded())
        let channels = Int(stream.mChannelsPerFrame)
        guard (1...AudioLimits.maximumSampleRate).contains(sampleRate),
            (1...AudioLimits.maximumChannels).contains(channels)
        else {
            throw NativeFailure(
                "LIMIT_EXCEEDED",
                "Source \(source.lastPathComponent) reports \(sampleRate) Hz and \(channels) channels, outside the excerpt bounds."
            )
        }
        // Empty edits hold no sample. AVFoundation would read them back as silence, which is
        // indistinguishable from recorded quiet, so absence is decided from the container's own
        // occupied segments rather than from the samples it is willing to produce.
        let occupied = segments.map {
            TimeSpan(
                startUs: microseconds($0.asset.start) + plan.sourceOffsetUs,
                endUs: microseconds(CMTimeRangeGetEnd($0.asset)) + plan.sourceOffsetUs)
        }
        return SourceTrack(
            plan: plan, url: input.url, input: input, asset: asset,
            track: audio, sampleRate: sampleRate, channels: channels,
            // A container cannot testify that acquisition happened: it will decode padding for a
            // hole the caller knows nothing was captured over. Only where the caller's evidence and
            // the file agree is material read; everywhere else is reported unavailable and silent.
            available: TimeSpan.intersection(plan.available, occupied))
    }

}

final class ConvertedAudioInterval {
    private let sourceInput: MediaInput
    private let reader: AVAssetReader
    private let converter: AVAudioConverter
    private let input: ConversionInput
    private let converted: AVAudioPCMBuffer
    private let channels: Int
    private var offset = 0
    private var exhausted = false

    init(source: SourceTrack, interval: TimeSpan, outputRate: Int, owed: Int64) throws {
        sourceInput = source.input
        guard
            let sourceFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: Double(source.sampleRate),
                channels: AVAudioChannelCount(source.channels), interleaved: true),
            let excerptFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: Double(outputRate),
                channels: AVAudioChannelCount(source.channels), interleaved: true),
            // Both sides carry this file's own channel count, so the converter changes rate only and
            // the explicit map below places the channels; a remix matrix would restate the gains.
            let converter = AVAudioConverter(from: sourceFormat, to: excerptFormat)
        else {
            throw NativeFailure.decodeFailed("Cannot convert \(source.sampleRate) Hz \(source.channels) channel \(source.url.lastPathComponent) to \(outputRate) Hz."
            )
        }
        let openedReader: AVAssetReader
        do { openedReader = try AVAssetReader(asset: source.asset) } catch {
            throw NativeFailure.decodeFailed("Cannot read \(source.url.path): \(error.localizedDescription)")
        }
        // Read as long as the output frames this interval owns, rather than as the interval's own
        // microseconds: a converter answers N input frames with floor(N x rate ratio) frames, so a
        // fractional interval whose last output frame the layout quantised up would otherwise be
        // asked for a frame the input it was given cannot reach. That end sits at most one output
        // frame past the requested boundary, which is the frame the layout already quantised to.
        let start = time(microseconds: interval.startUs - source.plan.sourceOffsetUs)
        openedReader.timeRange = CMTimeRange(
            start: start,
            end: CMTimeAdd(start, CMTime(value: owed, timescale: CMTimeScale(outputRate))))
        let output = AVAssetReaderTrackOutput(
            track: source.track,
            outputSettings: [
                // Decoded at this file's own rate and channel count. Resampling inside the reader
                // cannot be flushed, and the platform's remix matrix would silently change the
                // contract's gains.
                AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: source.sampleRate,
                AVNumberOfChannelsKey: source.channels, AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true, AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ])
        output.alwaysCopiesSampleData = false
        guard openedReader.canAdd(output) else {
            throw NativeFailure.decodeFailed("Cannot decode audio track of \(source.url.path).")
        }
        openedReader.add(output)

        let openedInput = ConversionInput(reading: output, as: sourceFormat)
        // One buffer, drained into the excerpt and refilled, so a 30 second interval costs the same
        // conversion memory as a 10 millisecond one.
        guard let converted = AVAudioPCMBuffer(pcmFormat: excerptFormat, frameCapacity: 8_192)
        else {
            throw NativeFailure.decodeFailed("Cannot allocate a conversion buffer for \(source.url.lastPathComponent).")
        }

        guard openedReader.startReading() else {
            if let detail = sourceInput.failure { throw detail }
            throw NativeFailure.decodeFailed("Cannot start audio reader.")
        }
        self.reader = openedReader
        self.converter = converter
        self.input = openedInput
        self.converted = converted
        self.channels = source.channels
    }

    deinit { reader.cancelReading() }

    func mix(
        into samples: inout [Float], at destination: Int, frames: Int,
        gain: Float, channelMap: [Int]
    ) throws {
        var written = 0
        while written < frames {
            if offset == Int(converted.frameLength) {
                guard !exhausted else {
                    if let detail = sourceInput.failure {
                        throw detail
                    }
                    throw NativeFailure.decodeFailed("Audio interval ended before its quantized output boundary.")
                }
                var failure: NSError?
                let input = self.input
                let outcome = converter.convert(to: converted, error: &failure) { _, status in
                    input.next(status)
                }
                guard !input.undecodable, outcome != .error, reader.status != .failed,
                    converted.frameLength > 0
                else {
                    if let detail = sourceInput.failure {
                        throw detail
                    }
                    throw NativeFailure.decodeFailed("Audio conversion made no progress: \(failure?.localizedDescription ?? "short decoded coverage")"
                    )
                }
                exhausted = outcome == .endOfStream
                offset = 0
            }
            let count = min(frames - written, Int(converted.frameLength) - offset)
            let decoded = converted.floatChannelData![0]
            for frame in 0..<count {
                let base = (destination + written + frame) * channelMap.count
                for (channel, sourceChannel) in channelMap.enumerated() {
                    samples[base + channel] +=
                        gain * decoded[(offset + frame) * channels + sourceChannel]
                }
            }
            offset += count
            written += count
        }
    }
}

/// One reader's decoded frames, handed to a converter one buffer at a time. AVAudioConverter calls
/// its input block synchronously from inside `convert`, so this state is only ever reached from the
/// thread doing the conversion; it lives in an object because that block is declared sendable.
private final class ConversionInput: @unchecked Sendable {
    private let output: AVAssetReaderTrackOutput
    private let format: AVAudioFormat
    /// The converter reads the supplied buffer during the call it was returned in, so each one is
    /// held until the next replaces it.
    private var supplied: AVAudioPCMBuffer?
    private(set) var undecodable = false

    init(reading output: AVAssetReaderTrackOutput, as format: AVAudioFormat) {
        self.output = output
        self.format = format
    }

    func next(_ status: UnsafeMutablePointer<AVAudioConverterInputStatus>) -> AVAudioPCMBuffer? {
        let copied: AVAudioPCMBuffer? = autoreleasepool {
            guard let sample = output.copyNextSampleBuffer() else { return nil }
            guard let buffer = copy(of: sample) else {
                undecodable = true
                return nil
            }
            return buffer
        }
        // End of this interval's material, not a dry input: the converter is told the stream ended
        // so that it flushes the output its filter still owes instead of waiting for more frames.
        guard let buffer = copied else {
            status.pointee = .endOfStream
            return nil
        }
        supplied = buffer
        status.pointee = .haveData
        return buffer
    }

    /// Copies one decoded sample buffer into a PCM buffer the converter can read. The reader hands
    /// back samples it does not copy, so they are taken while its block buffer is still retained.
    private func copy(of sample: CMSampleBuffer) -> AVAudioPCMBuffer? {
        var list = AudioBufferList()
        var block: CMBlockBuffer?
        let frames = CMSampleBufferGetNumSamples(sample)
        guard frames > 0, frames <= 65_536,
            CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sample, bufferListSizeNeededOut: nil, bufferListOut: &list,
                bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
                blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block) == noErr,
            let decoded = list.mBuffers.mData?.assumingMemoryBound(to: Float.self),
            let buffer = AVAudioPCMBuffer(
                pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))
        else { return nil }
        buffer.frameLength = AVAudioFrameCount(frames)
        buffer.floatChannelData![0].update(from: decoded, count: frames * Int(format.channelCount))
        return buffer
    }
}
