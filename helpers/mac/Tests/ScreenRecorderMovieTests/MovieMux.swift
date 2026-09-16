@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames

/// Copies the already-rendered H.264 samples and consumes the sole retained PCM mixer.
/// Both writer inputs finish before the caller may publish this attempt's file.
enum MovieMux {
    static func write(video: URL, audio: AudioPCMStream, durationUs: Int64, output: URL)
        async throws
    {
        let inputs = try await Inputs(
            video: video, rate: audio.format.sampleRate,
            channels: audio.format.channels, output: output)
        do {
            // Each pump owns at most one block; actor reentrancy lets the other input advance
            // while the writer applies interleaving backpressure.
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
            var a = rate
            var b = 1_000_000
            while b != 0 { (a, b) = (b, a % b) }
            let scale = Int64(rate / a) * 1_000_000
            guard scale <= Int64(Int32.max) else {
                throw failure("Cannot represent audio and video on one movie clock.")
            }
            writer.movieTimeScale = Int32(scale)
            picture = AVAssetWriterInput(
                mediaType: .video, outputSettings: nil, sourceFormatHint: description)
            picture.mediaTimeScale = 1_000_000
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: rate,
                AVNumberOfChannelsKey: channels, AVEncoderBitRateKey: channels * 96_000,
            ]
            guard writer.canApply(outputSettings: settings, forMediaType: .audio) else {
                throw AudioFailure(
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
            while true {
                try Task.checkCancellation()
                guard let sample = autoreleasepool(invoking: { samples.copyNextSampleBuffer() })
                else { break }
                try await ready(picture)
                guard picture.append(sample) else {
                    throw failure("Cannot copy rendered video samples.")
                }
            }
            guard reader.status == .completed else {
                throw failure("Rendered video reader ended early.")
            }
            picture.markAsFinished()
        }

        func finish(durationUs: Int64) async throws {
            try Task.checkCancellation()
            writer.endSession(atSourceTime: CMTime(value: durationUs, timescale: 1_000_000))
            await writer.finishWriting()
            try Task.checkCancellation()
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
            while !input.isReadyForMoreMediaData {
                try Task.checkCancellation()
                guard writer.status == .writing, ContinuousClock.now < deadline else {
                    throw failure("Movie writer stopped making progress.")
                }
                try await Task.sleep(for: .milliseconds(1))
            }
            try Task.checkCancellation()
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

    private static func failure(_ message: String) -> AudioFailure {
        AudioFailure("NATIVE_DECODE_FAILED", message)
    }
}
