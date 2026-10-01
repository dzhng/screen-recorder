@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderMedia

/// Copies already-rendered H.264 samples and consumes a bounded PCM source.
/// Both writer inputs finish before the caller may publish this attempt's file.
enum MovieMux {
    static func write(
        video: URL, audio: any AudioPCMSource, durationUs: Int64, output: URL,
        settings: OutputSettings.Audio? = nil
    )
        async throws
    {
        let inputs = try await Inputs(
            video: video, rate: audio.format.sampleRate, channels: audio.format.channels,
            output: output, settings: settings)
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

        init(
            video: URL, rate: Int, channels: Int, output: URL,
            settings outputSettings: OutputSettings.Audio?
        ) async throws {
            let asset = AVURLAsset(url: video)
            guard let track = try await asset.loadTracks(withMediaType: .video).first,
                let description = try await track.load(.formatDescriptions).first
            else { throw failure("Rendered video has no compressed track.") }
            self.rate = rate
            self.channels = channels
            format = try AudioSampleBuffer.description(rate: rate, channels: channels)
            reader = try AVAssetReader(asset: asset)
            samples = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
            samples.alwaysCopiesSampleData = false
            reader.add(samples)
            writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
            var clock = MovieClock()
            let videoScale = try await track.load(.naturalTimeScale)
            try clock.include(videoScale)
            try clock.include(Int32(rate))
            try clock.include(Int32(outputSettings?.sampleRate ?? rate))
            writer.movieTimeScale = clock.timescale
            picture = AVAssetWriterInput(
                mediaType: .video, outputSettings: nil, sourceFormatHint: description)
            picture.mediaTimeScale = videoScale
            let settings: [String: Any] =
                try outputSettings?.dictionary() ?? [
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
            let sample = try AudioSampleBuffer.sample(block, format: format, rate: rate, channels: channels)
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

    private static func failure(_ message: String) -> NativeFailure {
        NativeFailure.decodeFailed(message)
    }
}
