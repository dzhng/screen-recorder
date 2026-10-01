@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderMedia

enum AudioFileOperation {
    private struct Validation: Codable { let settings: OutputSettings.AudioFile }
    private struct Request: Codable {
        struct Input: Codable {
            let sampleRate: Int
            let channels: Int
            let frames: Int64
        }
        let source: String
        let output: String
        let input: Input
        let settings: OutputSettings.AudioFile
    }
    struct Result: Encodable {
        let file: String
        let bytes: Int
        let settings: OutputSettings.AudioFile
        let sampleRate: Int
        let channels: Int
        let inputFrames: Int64
        let durationUs: Int64
        let encodedFrames: Int64
        let contentFrames: Int64
    }

    static func validate(_ params: [String: Any]) throws -> OutputSettings.AudioFile {
        let resolved = try WireRequest.decode(Validation.self, from: params).settings
        try resolved.validate()
        return resolved
    }

    static func execute(_ params: [String: Any]) async throws -> Result {
        let request = try WireRequest.decode(Request.self, from: params)
        let settings = request.settings
        try settings.validate()
        try WireRequest.requireAbsolute(request.source, request.output)
        guard request.input.sampleRate == 48_000, request.input.channels == 2,
            request.input.frames > 0,
            let source = try MediaDescriptor(
                url: URL(fileURLWithPath: request.source), writable: false),
            fcntl(source.descriptor, F_GETFL) & O_ACCMODE == O_RDONLY
        else {
            throw NativeFailure(
                "INVALID_REQUEST",
                "Standalone encoding requires verified readonly 48kHz stereo Float32 PCM.")
        }
        let identity = try ArchiveOperation.FileVersion(of: source.descriptor)
        let converted = try await SelectedAudioConversion.open(
            source: source.url,
            sampleRate: settings.audio.sampleRate, channels: settings.audio.channels)
        guard converted.input.sampleRate == request.input.sampleRate,
            converted.input.channels == request.input.channels,
            converted.input.frames == request.input.frames
        else {
            throw NativeFailure(
                "ARTIFACT_CHANGED", "PCM source does not match its supplied dimensions.")
        }
        let output = try NewFile(at: request.output, assembledAs: "audio.m4a")
        defer { output.discard() }
        let durationUs = Int64(Int128(request.input.frames) * 1_000_000 / 48_000)
        try await write(
            converted, to: output.url, settings: settings.audio, inputFrames: request.input.frames)
        try Task.checkCancellation()
        let encoded = try AVAudioFile(forReading: output.url)
        let basic = encoded.fileFormat.streamDescription.pointee
        let asset = AVURLAsset(url: output.url)
        guard let track = try await asset.loadTracks(withMediaType: .audio).first else {
            throw NativeFailure.decodeFailed("AAC output has no presented audio track.")
        }
        let span = try await track.load(.timeRange)
        let contentFrames = try ExactTime(span.duration).sample(settings.audio.sampleRate)
        guard basic.mFormatID == kAudioFormatMPEG4AAC,
            Int(basic.mSampleRate) == settings.audio.sampleRate,
            Int(basic.mChannelsPerFrame) == settings.audio.channels,
            encoded.length > 0, CMTimeCompare(span.start, .zero) == 0,
            contentFrames == converted.frames
        else {
            throw NativeFailure.decodeFailed("AAC encoder changed the requested rendition or content length.")
        }
        guard try ArchiveOperation.FileVersion(of: source.descriptor) == identity else {
            throw NativeFailure("ARTIFACT_CHANGED", "Retained PCM changed during encoding.")
        }
        try Task.checkCancellation()
        return Result(
            file: request.output, bytes: try output.publish(), settings: settings,
            sampleRate: Int(basic.mSampleRate), channels: Int(basic.mChannelsPerFrame),
            inputFrames: request.input.frames,
            durationUs: durationUs,
            encodedFrames: encoded.length, contentFrames: contentFrames)
    }

    private static func write(
        _ source: SelectedAudioConversion, to output: URL,
        settings: OutputSettings.Audio, inputFrames: Int64
    ) async throws {
        // ISO MPEG-4 with only AAC tracks is M4A. The MP4 writer emits a zero-origin edit list
        // that trims AAC priming; the M4A writer leaves that timing only in Apple metadata.
        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        var clock = MovieClock()
        try clock.include(48_000)
        try clock.include(Int32(source.format.sampleRate))
        writer.movieTimeScale = clock.timescale
        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: try settings.dictionary())
        let format = try AudioSampleBuffer.description(
            rate: source.format.sampleRate, channels: source.format.channels)
        guard writer.canAdd(input) else {
            throw NativeFailure.decodeFailed("Cannot add AAC writer input.")
        }
        writer.add(input)
        guard writer.startWriting() else {
            throw NativeFailure.decodeFailed("Cannot start AAC writer.")
        }
        writer.startSession(atSourceTime: .zero)
        do {
            try await source.consume { block in
                let deadline = ContinuousClock.now.advanced(by: .seconds(10))
                while !input.isReadyForMoreMediaData {
                    try Task.checkCancellation()
                    guard writer.status == .writing, ContinuousClock.now < deadline else {
                        throw NativeFailure.decodeFailed("AAC writer stopped making progress.")
                    }
                    try await Task.sleep(for: .milliseconds(1))
                }
                try Task.checkCancellation()
                let sample = try AudioSampleBuffer.sample(
                    block, format: format,
                    rate: source.format.sampleRate, channels: source.format.channels)
                guard input.append(sample) else {
                    throw NativeFailure.decodeFailed(
                        "Cannot encode AAC: \(writer.error?.localizedDescription ?? "writer failed")."
                    )
                }
            }
            input.markAsFinished()
            writer.endSession(atSourceTime: CMTime(value: inputFrames, timescale: 48_000))
            await writer.finishWriting()
            try Task.checkCancellation()
            guard writer.status == .completed else {
                throw NativeFailure.decodeFailed(
                    "Cannot finish AAC: \(writer.error?.localizedDescription ?? "writer failed").")
            }
        } catch {
            if writer.status == .writing { writer.cancelWriting() }
            throw error
        }
    }
}
