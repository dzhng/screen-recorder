@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

/// One source stream, opened once. Caller-supplied source-clock support is intersected with
/// occupied container segments; the offset maps between those two clocks.
struct SourceTrack {
    let sourceOffsetUs: Int64
    let url: URL
    let input: MediaInput
    let asset: AVURLAsset
    let track: AVAssetTrack
    let sampleRate: Int
    let packetFrames: Int
    let channels: Int
    let available: [TimeSpan]

    static func open(selection: AudioSourceSelection, strictWindowFormat: Bool = false) async throws -> SourceTrack {
        try await open(source: selection.source, streamId: selection.streamId,
            sourceOffsetUs: selection.sourceOffsetUs, available: selection.available, strictWindowFormat: strictWindowFormat)
    }

    static func open(
        source path: String, streamId: String?, sourceOffsetUs: Int64,
        available: [TimeSpan], strictWindowFormat: Bool = false
    ) async throws -> SourceTrack {
        let source = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: source.path) else {
            throw NativeFailure.decodeFailed("No source media at \(source.path).")
        }
        let input = try MediaInput(url: source)
        let asset = input.asset
        let audio: AVAssetTrack
        let stream: AudioStreamBasicDescription
        let segments: [SourceSegment]
        do {
            let tracks = try await asset.loadTracks(withMediaType: .audio)
            guard streamId != nil || tracks.count == 1 else {
                throw NativeFailure("INVALID_REQUEST", "An omitted stream ID requires exactly one audio stream.")
            }
            guard
                let track = tracks.first(where: {
                    streamId == nil || streamId == "track:\($0.trackID)"
                })
            else {
                throw NativeFailure.decodeFailed(
                    "Source has no matching audio track: \(source.path).")
            }
            let descriptions = try await track.load(.formatDescriptions)
            if strictWindowFormat { try Self.validateWindowFormats(descriptions) }
            guard let description = descriptions.first,
                let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee
            else {
                throw NativeFailure.decodeFailed(
                    "Source audio format is unreadable: \(source.path).")
            }
            audio = track
            stream = basic
            segments = SourceSegment.occupied(of: try await track.load(.segments))
        } catch let failure as NativeFailure {
            if let detail = input.failure { throw detail }
            throw failure
        } catch {
            if let detail = input.failure { throw detail }
            throw NativeFailure.decodeFailed(
                "Cannot open \(source.path): \(error.localizedDescription)")
        }
        let sampleRate = Int(stream.mSampleRate.rounded())
        let channels = Int(stream.mChannelsPerFrame)
        guard (1...32_768).contains(stream.mFramesPerPacket) else {
            throw NativeFailure("UNSUPPORTED_FORMAT", "Audio decoding requires a fixed packet size of at most 32768 native frames.")
        }
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
                startUs: microseconds($0.asset.start) + sourceOffsetUs,
                endUs: microseconds(CMTimeRangeGetEnd($0.asset)) + sourceOffsetUs)
        }
        // Adjacent declarations describe continuous capture, so they must not restart decoding.
        // Even a one-microsecond hole remains a real exclusion; physical segment edges stay intact.
        var continuous: [TimeSpan] = []
        for interval in available {
            if let previous = continuous.last, previous.endUs == interval.startUs {
                continuous[continuous.count - 1] = TimeSpan(
                    startUs: previous.startUs, endUs: interval.endUs)
            } else {
                continuous.append(interval)
            }
        }
        return SourceTrack(
            sourceOffsetUs: sourceOffsetUs, url: input.url, input: input, asset: asset,
            track: audio, sampleRate: sampleRate, packetFrames: Int(stream.mFramesPerPacket), channels: channels,
            // Physical occupancy is not acquisition evidence. Recording callers supply acquired
            // intervals here; composition execution additionally intersects its retained domains.
            available: TimeSpan.intersection(continuous, occupied))
    }

    private static func validateWindowFormats(_ descriptions: [CMAudioFormatDescription]) throws {
        var signature: [Double]?
        for description in descriptions {
            guard let value = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee,
                value.mSampleRate.isFinite, value.mSampleRate.rounded() == value.mSampleRate,
                (1...Double(AudioLimits.maximumSampleRate)).contains(value.mSampleRate),
                value.mChannelsPerFrame == 1 || value.mChannelsPerFrame == 2
            else { throw NativeFailure("UNSUPPORTED_FORMAT", "Source windows require an integral native rate and mono or stereo audio.") }
            let current = [value.mSampleRate, Double(value.mChannelsPerFrame)]
            guard signature == nil || signature == current else {
                throw NativeFailure("UNSUPPORTED_FORMAT", "Source format changes within the stream.")
            }
            signature = current
            guard let layout = CMAudioFormatDescriptionGetChannelLayout(description, sizeOut: nil) else { continue }
            let tag = layout.pointee.mChannelLayoutTag
            let channels = value.mChannelsPerFrame
            var conventional = tag == (channels == 1 ? kAudioChannelLayoutTag_Mono : kAudioChannelLayoutTag_Stereo)
            if tag == kAudioChannelLayoutTag_UseChannelBitmap {
                conventional = layout.pointee.mChannelBitmap == (channels == 1 ? AudioChannelBitmap.bit_Center : AudioChannelBitmap.bit_Left.union(.bit_Right))
            } else if tag == kAudioChannelLayoutTag_UseChannelDescriptions, layout.pointee.mNumberChannelDescriptions == channels {
                let pointer = UnsafeRawPointer(layout).advanced(by: MemoryLayout<AudioChannelLayout>.offset(of: \.mChannelDescriptions)!).assumingMemoryBound(to: AudioChannelDescription.self)
                conventional = channels == 1
                    ? [kAudioChannelLabel_Mono, kAudioChannelLabel_Center].contains(pointer[0].mChannelLabel)
                    : pointer[0].mChannelLabel == kAudioChannelLabel_Left && pointer[1].mChannelLabel == kAudioChannelLabel_Right
            }
            guard conventional else { throw NativeFailure("UNSUPPORTED_FORMAT", "Source channel layout is not conventional mono or stereo.") }
        }
    }

}

final class ConvertedAudioInterval {
    private let sourceInput: MediaInput
    private let converter: AVAudioConverter
    private let input: ConversionInput
    private let converted: AVAudioPCMBuffer
    private let channels: Int
    private var offset = 0
    private var exhausted = false
    private var paddingFrames: Int

    convenience init(
        source: SourceTrack, decoder: AudioSourceReader, interval: TimeSpan,
        outputRate: Int, owed: Int64
    ) throws {
        try self.init(
            source: source, decoder: decoder,
            start: time(microseconds: interval.startUs - source.sourceOffsetUs),
            outputRate: outputRate, owed: owed)
    }

    init(
        source: SourceTrack, decoder: AudioSourceReader, start: CMTime,
        outputRate: Int, owed: Int64, end limit: CMTime? = nil
    ) throws {
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
            throw NativeFailure.decodeFailed(
                "Cannot convert \(source.sampleRate) Hz \(source.channels) channel \(source.url.lastPathComponent) to \(outputRate) Hz."
            )
        }
        // Cumulative layout rounding owns the duration, including a last frame rounded up.
        let requestedEnd = CMTimeAdd(start, CMTime(value: owed, timescale: CMTimeScale(outputRate)))
        let end = limit.map { min($0, requestedEnd) } ?? requestedEnd
        let first = CMTimeConvertScale(
            start, timescale: CMTimeScale(source.sampleRate),
            method: .roundHalfAwayFromZero
        ).value
        let last = CMTimeConvertScale(
            end, timescale: CMTimeScale(source.sampleRate),
            method: .roundTowardPositiveInfinity
        ).value
        // Native selection and cumulative output use different integer clocks. Only their
        // arithmetic shortfall may be zero-extended, and only after the reader reaches end.
        let covered = Int128(max(0, last - first)) * Int128(outputRate) / Int128(source.sampleRate)
        paddingFrames = Int(max(0, Int128(owed) - covered))
        try decoder.begin(at: start, end: end)
        let openedInput = ConversionInput(reader: decoder)
        guard let converted = AVAudioPCMBuffer(pcmFormat: excerptFormat, frameCapacity: 8_192)
        else { throw NativeFailure.decodeFailed("Cannot allocate audio conversion buffer.") }
        self.converter = converter
        self.input = openedInput
        self.converted = converted
        self.channels = source.channels
    }

    func mix(
        into samples: inout [Float], at destination: Int, frames: Int,
        gain: Float, channelMap: [Int]
    ) throws {
        var written = 0
        while written < frames {
            if offset == Int(converted.frameLength) {
                if exhausted, frames - written <= paddingFrames, input.reachedSelectionEnd {
                    paddingFrames -= frames - written
                    return
                }
                guard !exhausted else {
                    if let detail = sourceInput.failure {
                        throw detail
                    }
                    throw NativeFailure.decodeFailed(
                        "Audio interval ended before its quantized output boundary.")
                }
                var failure: NSError?
                let input = self.input
                let outcome = converter.convert(to: converted, error: &failure) { _, status in
                    input.next(status)
                }
                if let error = input.failure { throw error }
                if outcome == .endOfStream, converted.frameLength == 0,
                    frames - written <= paddingFrames, input.reachedSelectionEnd
                {
                    paddingFrames -= frames - written
                    exhausted = true
                    return
                }
                guard outcome != .error, !input.readerFailed,
                    converted.frameLength > 0
                else {
                    if let detail = sourceInput.failure {
                        throw detail
                    }
                    throw NativeFailure.decodeFailed(
                        "Audio conversion made no progress: \(failure?.localizedDescription ?? "short decoded coverage")"
                    )
                }
                exhausted = outcome == .endOfStream
                offset = 0
            }
            let count = min(frames - written, Int(converted.frameLength) - offset)
            let decoded = converted.floatChannelData![0]
            samples.withUnsafeMutableBufferPointer { output in
                for channel in channelMap.indices {
                    let sourceChannel = channelMap[channel]
                    var frame = 0
                    while frame < count {
                        output[(destination + written + frame) * channelMap.count + channel] +=
                            gain * decoded[(offset + frame) * channels + sourceChannel]
                        frame += 1
                    }
                }
            }
            offset += count
            written += count
        }
    }
}

/// Decodes ordered intervals with one bounded sample buffer. Conversion remains interval-local:
/// excluded samples can be decoded while skipping forward, but never enter a resampling filter.
final class AudioSourceReader {
    private let source: SourceTrack
    private var reader: AVAssetReader?
    private var output: AVAssetReaderTrackOutput?
    private var pending: CMSampleBuffer?
    private let format: AVAudioFormat
    private var position = CMTime.zero
    private var end = CMTime.zero
    private var intervalStart = CMTime.zero
    private var reopened = false
    private var requireContinuation = false
    private(set) var decodedFrames: Int64 = 0
    var failed: Bool { reader?.status == .failed }
    var reachedSelectionEnd: Bool { position >= end }

    init(source: SourceTrack) {
        self.source = source
        self.format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: Double(source.sampleRate),
            channels: AVAudioChannelCount(source.channels), interleaved: true)!
    }

    deinit { reader?.cancelReading() }

    func begin(at start: CMTime, end: CMTime) throws {
        // Seeking across a long hole must not decode the excluded recording. Nearby intervals
        // amortize reader setup; at most one second of discarded audio is scanned per join.
        if reader == nil || CMTimeGetSeconds(CMTimeSubtract(start, self.end)) > 1 {
            try open(at: start)
        }
        self.position = start
        self.end = end
        intervalStart = start
        reopened = false
        requireContinuation = false
    }

    static func decodeStart(at start: CMTime, packetFrames: Int, sampleRate: Int) -> CMTime {
        let context = CMTime(value: Int64(packetFrames) * 2,
            timescale: CMTimeScale(sampleRate))
        // Negative presentation origins are valid; keep their requested seek rather than
        // advancing it to zero. Nonnegative seeks retain bounded packet lookbehind.
        return min(start, max(.zero, CMTimeSubtract(start, context)))
    }

    private func open(at start: CMTime) throws {
        reader?.cancelReading()
        pending = nil
        let opened: AVAssetReader
        do { opened = try AVAssetReader(asset: source.asset) } catch {
            if let detail = source.input.failure { throw detail }
            throw NativeFailure.decodeFailed(
                "Cannot read \(source.url.path): \(error.localizedDescription)")
        }
        // Seeking inside the last compressed packet can refuse or omit its PCM. Two packet
        // widths include the preceding packet even when start lies inside a packet. next()
        // discards this bounded context before any selected samples reach the converter.
        let decodeStart = Self.decodeStart(at: start,
            packetFrames: source.packetFrames, sampleRate: source.sampleRate)
        opened.timeRange = CMTimeRange(start: decodeStart, duration: .positiveInfinity)
        let output = AVAssetReaderTrackOutput(
            track: source.track,
            outputSettings: [
                AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: source.sampleRate,
                AVNumberOfChannelsKey: source.channels, AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true, AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false,
            ])
        output.alwaysCopiesSampleData = false
        guard opened.canAdd(output) else {
            throw NativeFailure.decodeFailed("Cannot decode audio track.")
        }
        opened.add(output)
        guard opened.startReading() else {
            if let detail = source.input.failure { throw detail }
            throw NativeFailure.decodeFailed("Cannot start audio reader.")
        }
        self.reader = opened
        self.output = output
    }

    func next() throws -> AVAudioPCMBuffer? {
        guard position < end else { return nil }
        while true {
            try Task.checkCancellation()
            if pending == nil {
                pending = output?.copyNextSampleBuffer()
                if let pending { decodedFrames += Int64(CMSampleBufferGetNumSamples(pending)) }
            }
            guard let sample = pending else {
                if let detail = source.input.failure { throw detail }
                if failed { throw NativeFailure.decodeFailed("Audio reader failed.") }
                // A completed AAC reader can stop before its declared end while a seek still
                // returns the real tail. Retry only once, at the exact next sample, never padding.
                if reader?.status == .completed, !reopened, position > intervalStart, position < end {
                    reopened = true
                    requireContinuation = true
                    try open(at: position)
                    continue
                }
                return nil
            }
            let frames = CMSampleBufferGetNumSamples(sample)
            let stamp = CMSampleBufferGetPresentationTimeStamp(sample)
            func frame(_ time: CMTime, rounding: CMTimeRoundingMethod) -> Int {
                Int(
                    CMTimeConvertScale(
                        CMTimeSubtract(time, stamp), timescale: CMTimeScale(source.sampleRate),
                        method: rounding
                    ).value)
            }
            let first = max(0, frame(position, rounding: .roundHalfAwayFromZero))
            // Keep the source frame intersecting the quantized end, as AVAssetReader's
            // timeRange does. Rounding it down can leave a rate converter one frame short.
            let last = min(frames, frame(end, rounding: .roundTowardPositiveInfinity))
            if first >= frames {
                pending = nil
                continue
            }
            if last <= first { return nil }
            if requireContinuation {
                let resumed = CMTimeAdd(stamp,
                    CMTime(value: Int64(first), timescale: CMTimeScale(source.sampleRate)))
                guard resumed == position else {
                    throw NativeFailure.decodeFailed("Recovered audio skipped an unread source interval.")
                }
                requireContinuation = false
            }
            var list = AudioBufferList()
            var block: CMBlockBuffer?
            guard frames > 0, frames <= 65_536,
                CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                    sample, bufferListSizeNeededOut: nil, bufferListOut: &list,
                    bufferListSize: MemoryLayout<AudioBufferList>.size, blockBufferAllocator: nil,
                    blockBufferMemoryAllocator: nil, flags: 0, blockBufferOut: &block) == noErr,
                let decoded = list.mBuffers.mData?.assumingMemoryBound(to: Float.self),
                let buffer = AVAudioPCMBuffer(
                    pcmFormat: format, frameCapacity: AVAudioFrameCount(last - first))
            else { throw NativeFailure.decodeFailed("Cannot read decoded audio buffer.") }
            buffer.frameLength = AVAudioFrameCount(last - first)
            buffer.floatChannelData![0].update(
                from: decoded + first * source.channels,
                count: (last - first) * source.channels)
            position = CMTimeAdd(
                stamp, CMTime(value: Int64(last), timescale: CMTimeScale(source.sampleRate)))
            // Keep this packet until the next request: cumulative output rounding can make
            // successive intervals legitimately share a boundary source sample.
            return buffer
        }
    }
}

/// A fresh converter sees only one selected interval and an explicit end-of-stream flush.
/// Its input callback runs synchronously inside convert; no other thread advances this reader.
private final class ConversionInput: @unchecked Sendable {
    private let reader: AudioSourceReader
    private var supplied: AVAudioPCMBuffer?
    private(set) var failure: Error?
    var readerFailed: Bool { reader.failed }
    var reachedSelectionEnd: Bool { reader.reachedSelectionEnd }

    init(reader: AudioSourceReader) { self.reader = reader }

    func next(_ status: UnsafeMutablePointer<AVAudioConverterInputStatus>) -> AVAudioPCMBuffer? {
        do {
            let buffer = try autoreleasepool { try reader.next() }
            guard let buffer else {
                status.pointee = .endOfStream
                return nil
            }
            supplied = buffer
            status.pointee = .haveData
            return buffer
        } catch {
            failure = error
            status.pointee = .endOfStream
            return nil
        }
    }
}
