@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderMedia

/// Copies already-rendered H.264 samples and consumes a bounded PCM source.
/// Both writer inputs finish before the caller may publish this attempt's file.
enum MovieMux {
    static func write(video: URL, audio: any AudioPCMSource, durationUs: Int64, output: URL)
        async throws
    {
        let inputs = try await Inputs(
            video: video, rate: audio.format.sampleRate, channels: audio.format.channels,
            output: output)
        do {
            // The input actor shares the first failure promptly with the other pump.
            async let pictures: Void = inputs.copyVideo()
            try await audio.consume { try await inputs.appendAudio($0) }
            await inputs.finishAudio()
            try await pictures
            try await inputs.finish(durationUs: durationUs)
        } catch {
            await inputs.cancel()
            throw error
        }
    }

    private actor Inputs {
        let reader: AVAssetReader
        let samples: AVAssetReaderTrackOutput
        let writer: AVAssetWriter
        let picture: AVAssetWriterInput
        let sound: AVAssetWriterInput
        let format: CMAudioFormatDescription
        let rate: Int
        let channels: Int
        private var firstFailure: NativeFailure?

        init(video: URL, rate: Int, channels: Int, output: URL) async throws {
            let asset = AVURLAsset(url: video)
            guard let track = try await asset.loadTracks(withMediaType: .video).first,
                let description = try await track.load(.formatDescriptions).first
            else { throw failure("Rendered video has no compressed track.") }
            self.rate = rate
            self.channels = channels
            format = try pcmDescription(rate: rate, channels: channels)
            reader = try AVAssetReader(asset: asset)
            samples = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
            samples.alwaysCopiesSampleData = false
            reader.add(samples)
            writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
            var clock = MovieClock()
            let videoScale = try await track.load(.naturalTimeScale)
            try clock.include(videoScale)
            try clock.include(Int32(rate))
            writer.movieTimeScale = clock.timescale
            picture = AVAssetWriterInput(
                mediaType: .video, outputSettings: nil, sourceFormatHint: description)
            picture.mediaTimeScale = videoScale
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: rate,
                AVNumberOfChannelsKey: channels, AVEncoderBitRateKey: channels * 96_000,
            ]
            guard writer.canApply(outputSettings: settings, forMediaType: .audio) else {
                throw NativeFailure(
                    "UNSUPPORTED_FORMAT", "AAC cannot encode the resolved PCM format.")
            }
            sound = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
            writer.add(picture)
            writer.add(sound)
            guard reader.startReading(), writer.startWriting() else {
                reader.cancelReading()
                writer.cancelWriting()
                throw failure("Cannot start movie assembly.")
            }
            writer.startSession(atSourceTime: .zero)
        }

        func appendAudio(_ block: AudioPCMBlock) async throws {
            try await ready(sound)
            let sample = try pcmSample(block, format: format, rate: rate, channels: channels)
            guard sound.append(sample) else {
                throw failure(
                    "Cannot encode AAC: \(writer.error?.localizedDescription ?? "writer failed").")
            }
        }

        func finishAudio() { sound.markAsFinished() }

        func copyVideo() async throws {
            do {
                while true {
                    guard let sample = autoreleasepool(invoking: { samples.copyNextSampleBuffer() })
                    else { break }
                    try await ready(picture)
                    guard picture.append(sample) else {
                        throw failure(
                            "Cannot copy rendered video samples: \(writer.error?.localizedDescription ?? "writer failed")."
                        )
                    }
                }
                guard reader.status == .completed else {
                    throw failure(
                        "Rendered video reader ended early: \(reader.error?.localizedDescription ?? "reader failed")."
                    )
                }
                picture.markAsFinished()
            } catch let error as NativeFailure {
                if firstFailure == nil { firstFailure = error }
                cancel()
                throw error
            }
        }

        func finish(durationUs: Int64) async throws {
            writer.endSession(atSourceTime: CMTime(value: durationUs, timescale: 1_000_000))
            await writer.finishWriting()
            guard writer.status == .completed else {
                throw failure(
                    "Cannot finish movie: \(writer.error?.localizedDescription ?? "writer failed")."
                )
            }
        }

        func cancel() {
            reader.cancelReading()
            if writer.status == .writing { writer.cancelWriting() }
        }

        private func ready(_ input: AVAssetWriterInput) async throws {
            let deadline = ContinuousClock.now.advanced(by: .seconds(10))
            if let firstFailure { throw firstFailure }
            while !input.isReadyForMoreMediaData {
                if let firstFailure { throw firstFailure }
                guard writer.status == .writing, ContinuousClock.now < deadline else {
                    throw failure("Movie writer stopped making progress.")
                }
                try await Task.sleep(for: .milliseconds(1))
            }
            if let firstFailure { throw firstFailure }
        }
    }

    private static func pcmDescription(rate: Int, channels: Int) throws -> CMAudioFormatDescription
    {
        let bytes = UInt32(channels * MemoryLayout<Float>.size)
        var asbd = AudioStreamBasicDescription(
            mSampleRate: Double(rate), mFormatID: kAudioFormatLinearPCM,
            mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
            mBytesPerPacket: bytes, mFramesPerPacket: 1, mBytesPerFrame: bytes,
            mChannelsPerFrame: UInt32(channels), mBitsPerChannel: 32, mReserved: 0)
        var format: CMAudioFormatDescription?
        guard
            CMAudioFormatDescriptionCreate(
                allocator: kCFAllocatorDefault, asbd: &asbd, layoutSize: 0, layout: nil,
                magicCookieSize: 0, magicCookie: nil, extensions: nil,
                formatDescriptionOut: &format) == noErr, let format
        else { throw failure("Cannot describe PCM for AAC.") }
        return format
    }

    private static func pcmSample(
        _ block: AudioPCMBlock, format: CMAudioFormatDescription, rate: Int, channels: Int
    ) throws -> CMSampleBuffer {
        let bytes = block.samples.count * MemoryLayout<Float>.size
        var data: CMBlockBuffer?
        guard
            CMBlockBufferCreateWithMemoryBlock(
                allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: bytes,
                blockAllocator: kCFAllocatorDefault, customBlockSource: nil,
                offsetToData: 0, dataLength: bytes, flags: 0, blockBufferOut: &data) == noErr,
            let data
        else { throw failure("Cannot allocate AAC input block.") }
        let copied = block.samples.withUnsafeBytes {
            CMBlockBufferReplaceDataBytes(
                with: $0.baseAddress!, blockBuffer: data,
                offsetIntoDestination: 0, dataLength: bytes)
        }
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: Int32(rate)),
            presentationTimeStamp: CMTime(value: block.startFrame, timescale: Int32(rate)),
            decodeTimeStamp: .invalid)
        var size = channels * MemoryLayout<Float>.size
        var sample: CMSampleBuffer?
        guard copied == noErr,
            CMSampleBufferCreateReady(
                allocator: kCFAllocatorDefault, dataBuffer: data, formatDescription: format,
                sampleCount: block.frameCount, sampleTimingEntryCount: 1,
                sampleTimingArray: &timing,
                sampleSizeEntryCount: 1, sampleSizeArray: &size, sampleBufferOut: &sample) == noErr,
            let sample
        else { throw failure("Cannot create timestamped AAC input.") }
        return sample
    }

    private static func failure(_ message: String) -> NativeFailure {
        NativeFailure.decodeFailed(message)
    }
}
