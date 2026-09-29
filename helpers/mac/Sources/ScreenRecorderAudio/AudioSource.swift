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
    struct Run {
        let support: CompositionAudioPlan.Selection
        let nativeOrigin: ExactTime
    }
    let available: [Run]

    func frame(at time: ExactTime, in run: Run, ceil: Bool = false) throws -> Int64 {
        try time.subtract(ExactTime(Int128(sourceOffsetUs))).subtract(run.nativeOrigin)
            .sample(sampleRate, ceil: ceil, nearest: !ceil)
    }

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
        let sampleRate: Int
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
            // The native reader's fractional-to-integer conversion is not phase-stable when seeking.
            // Validate every description before any rate is converted to an integer.
            let rates = try descriptions.map { description in
                guard let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee else {
                    throw NativeFailure.decodeFailed("Source audio format is unreadable: \(source.path).")
                }
                return try Self.nativeSampleRate(basic.mSampleRate)
            }
            guard let description = descriptions.first, let rate = rates.first,
                let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee
            else {
                throw NativeFailure.decodeFailed(
                    "Source audio format is unreadable: \(source.path).")
            }
            audio = track
            stream = basic
            sampleRate = rate
            segments = SourceSegment.occupied(of: try await track.load(.segments))
        } catch let failure as NativeFailure {
            if let detail = input.failure { throw detail }
            throw failure
        } catch {
            if let detail = input.failure { throw detail }
            throw NativeFailure.decodeFailed(
                "Cannot open \(source.path): \(error.localizedDescription)")
        }
        let channels = Int(stream.mChannelsPerFrame)
        guard (1...32_768).contains(stream.mFramesPerPacket) else {
            throw NativeFailure("UNSUPPORTED_FORMAT", "Audio decoding requires a fixed packet size of at most 32768 native frames.")
        }
        guard (1...AudioLimits.maximumChannels).contains(channels)
        else {
            throw NativeFailure(
                "LIMIT_EXCEEDED",
                "Source \(source.lastPathComponent) reports \(sampleRate) Hz and \(channels) channels, outside the excerpt bounds."
            )
        }
        // Empty edits hold no sample. AVFoundation would read them back as silence, which is
        // indistinguishable from recorded quiet, so absence is decided from the container's own
        // occupied segments rather than from the samples it is willing to produce.
        let offset = ExactTime(-Int128(sourceOffsetUs))
        let occupied = try segments.map { segment in
            let origin = try ExactTime(segment.asset.start)
            return Run(support: CompositionAudioPlan.Selection(
                startUs: try origin.subtract(offset),
                endUs: try ExactTime(CMTimeRangeGetEnd(segment.asset)).subtract(offset)), nativeOrigin: origin)
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
        var available: [Run] = []
        var a = 0, b = 0
        while a < continuous.count && b < occupied.count {
            let mask = CompositionAudioPlan.Selection(continuous[a]), run = occupied[b]
            if let support = try mask.intersection(run.support) {
                available.append(Run(support: support, nativeOrigin: run.nativeOrigin))
            }
            if try mask.endUs.subtract(run.support.endUs).numerator < 0 { a += 1 }
            else { b += 1 }
        }
        return SourceTrack(
            sourceOffsetUs: sourceOffsetUs, url: input.url, input: input, asset: asset,
            track: audio, sampleRate: sampleRate, packetFrames: Int(stream.mFramesPerPacket), channels: channels,
            // Physical occupancy is not acquisition evidence. Recording callers supply acquired
            // intervals here; composition execution additionally intersects its retained domains.
            available: available)
    }

    private static func nativeSampleRate(_ rate: Double) throws -> Int {
        guard rate.isFinite, rate.rounded() == rate else {
            throw NativeFailure("UNSUPPORTED_FORMAT", "Audio execution requires an integral native sample rate.")
        }
        guard (1...Double(AudioLimits.maximumSampleRate)).contains(rate) else {
            throw NativeFailure("LIMIT_EXCEEDED", "Native audio sample rate is outside the supported bounds.")
        }
        return Int(rate)
    }

    private static func validateWindowFormats(_ descriptions: [CMAudioFormatDescription]) throws {
        var signature: [Double]?
        for description in descriptions {
            guard let value = CMAudioFormatDescriptionGetStreamBasicDescription(description)?.pointee,
                (try? nativeSampleRate(value.mSampleRate)) != nil,
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

    init(
        source: SourceTrack, decoder: AudioSourceReader, origin: ExactTime, start: Int64,
        outputRate: Int, owed: Int64, end limit: Int64? = nil
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
        let duration = (Int128(owed) * Int128(source.sampleRate) + Int128(outputRate) - 1) / Int128(outputRate)
        guard let requestedEnd = Int64(exactly: Int128(start) + duration) else {
            throw NativeFailure.decodeFailed("Audio selection exceeds native frame capacity.")
        }
        let end = limit.map { min($0, requestedEnd) } ?? requestedEnd
        let covered = Int128(max(0, end - start)) * Int128(outputRate) / Int128(source.sampleRate)
        paddingFrames = Int(max(0, Int128(owed) - covered))
        try decoder.begin(origin: origin, at: start, end: end)
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
                // convert replaces the buffer, including an empty end-of-stream result.
                // A later mix call must not reuse the previous buffer's consumed offset.
                offset = 0
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
    private var origin: ExactTime?
    private var position: Int64 = 0
    private var end: Int64 = 0
    private var intervalStart: Int64 = 0
    private var packetStart: Int64 = 0
    private var nextPacketStart: Int64 = 0
    private var expectedStamp = CMTime.zero
    private var reopened = false
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

    func begin(origin: ExactTime, at start: Int64, end: Int64) throws {
        // Nearby selections in the same physical run can share a decoded packet. A mask does
        // not establish a new sample origin; seek again when the run or bounded scan changes.
        if reader == nil || self.origin?.equals(origin) != true || start < packetStart
            || Int128(start) - Int128(position) > Int128(source.sampleRate) {
            self.origin = origin
            try open(at: start)
        }
        self.position = start
        self.end = end
        intervalStart = start
        reopened = false
    }

    static func seekTime(origin: ExactTime, frame: Int64, sampleRate: Int) throws -> CMTime {
        let cell = try origin.subtract(ExactTime(-Int128(frame) * 1_000_000, Int128(sampleRate)))
        let boundary = try cell.sample(1_000_000, ceil: true)
        let inside = boundary.addingReportingOverflow(1)
        guard !inside.overflow else { throw NativeFailure.decodeFailed("Audio seek exceeds native bounds.") }
        // At <=192kHz each native sample cell exceeds 5us. This integer-us point is >0 and
        // <=2us after its exact start, strictly inside without an unrepresentable CMTime LCM.
        return CMTime(value: inside.partialValue, timescale: 1_000_000)
    }

    private func open(at start: Int64) throws {
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
        let first = max(0, start - Int64(source.packetFrames) * 2)
        let seek = try Self.seekTime(origin: origin!, frame: first, sampleRate: source.sampleRate)
        opened.timeRange = CMTimeRange(start: seek, duration: .positiveInfinity)
        packetStart = first
        nextPacketStart = first
        expectedStamp = CMTime(value: try ExactTime(seek).sample(source.sampleRate),
            timescale: CMTimeScale(source.sampleRate))
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
                if let pending {
                    let frames = CMSampleBufferGetNumSamples(pending)
                    let stamp = CMSampleBufferGetPresentationTimeStamp(pending)
                    guard stamp.isNumeric, frames > 0, frames <= 65_536,
                        CMTimeConvertScale(CMTimeSubtract(stamp, expectedStamp),
                            timescale: CMTimeScale(source.sampleRate), method: .roundHalfAwayFromZero).value == 0
                    else { throw NativeFailure.decodeFailed("Decoded audio has discontinuous sample packets.") }
                    packetStart = nextPacketStart
                    nextPacketStart += Int64(frames)
                    expectedStamp = CMTimeAdd(stamp, CMTime(value: Int64(frames), timescale: CMTimeScale(source.sampleRate)))
                    decodedFrames += Int64(frames)
                }
            }
            guard let sample = pending else {
                if let detail = source.input.failure { throw detail }
                if failed { throw NativeFailure.decodeFailed("Audio reader failed.") }
                // A completed AAC reader can stop before its declared end while a seek still
                // returns the real tail. Retry only once, at the exact next sample, never padding.
                if reader?.status == .completed, !reopened, position > intervalStart, position < end {
                    reopened = true
                    try open(at: position)
                    continue
                }
                return nil
            }
            let frames = CMSampleBufferGetNumSamples(sample)
            let first = Int(max(0, position - packetStart))
            let last = Int(min(Int64(frames), end - packetStart))
            if first >= frames {
                pending = nil
                continue
            }
            if last <= first { return nil }
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
            position = packetStart + Int64(last)
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
