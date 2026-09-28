@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

/// The public excerpt remains capped; all retained-audio mixing belongs to AudioPCMStream.
public enum AudioExcerpts {
    public static func write(_ request: AudioExcerptRequest) async throws -> AudioExcerpt {
        try ExcerptValidation.check(
            tracks: request.tracks, spans: request.spans,
            maximumDurationUs: AudioLimits.maximumExcerptUs)
        let stream = try await AudioPCMStream.open(tracks: request.tracks, spans: request.spans)
        let bytes = try await AudioWave.write(stream, to: request.output)
        return AudioExcerpt(
            file: request.output.path, mediaType: "audio/wav", sampleRate: stream.format.sampleRate,
            channels: stream.format.channels, frames: stream.frames, durationUs: stream.durationUs,
            bytes: bytes, spans: request.spans, tracks: zip(request.tracks, stream.reports).map { AudioTrackReport(role: $0.role, source: $1) })
    }
}

/// Lossless sink shared with the internal streaming proof. Consumption finishes before publication.
public enum AudioWave {
    public static func write(_ stream: AudioPCMStream, to output: URL) async throws -> Int {
        let writer = try AudioWaveWriter(
            sampleRate: stream.format.sampleRate,
            channels: stream.format.channels, output: output, sources: stream.sourceURLs)
        defer { writer.discard() }
        try await stream.consume { try writer.write($0) }
        return try writer.finish()
    }
}

/// One float-WAVE sink for both recording excerpts and composition execution. Closing the file
/// precedes publication so every receipt describes a completed header and payload.
final class AudioWaveWriter {
    private let format: AVAudioFormat
    private let destination: OutputFile
    private var file: AVAudioFile?

    init(sampleRate: Int, channels: Int, output: URL, sources: [URL]) throws {
        guard
            let format = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: Double(sampleRate), channels: AVAudioChannelCount(channels),
                interleaved: true)
        else {
            throw NativeFailure.decodeFailed("Cannot describe audio output format.")
        }
        self.format = format
        destination = try OutputFile(output.path, assembledAs: "mix.wav", distinctFrom: sources)
        var settings = format.settings
        settings[AVAudioFileTypeKey] = kAudioFileWAVEType
        do {
            file = try AVAudioFile(
                forWriting: destination.url, settings: settings,
                commonFormat: .pcmFormatFloat32, interleaved: true)
        } catch {
            destination.discard()
            throw NativeFailure.decodeFailed(
                "Cannot open audio output: \(error.localizedDescription)")
        }
    }
    func write(_ block: AudioPCMBlock) throws {
        try autoreleasepool {
            guard let file,
                let buffer = AVAudioPCMBuffer(
                    pcmFormat: format,
                    frameCapacity: AVAudioFrameCount(block.frameCount))
            else {
                throw NativeFailure.decodeFailed("Cannot allocate WAVE block.")
            }
            buffer.frameLength = AVAudioFrameCount(block.frameCount)
            block.samples.withUnsafeBufferPointer {
                buffer.floatChannelData![0].update(from: $0.baseAddress!, count: $0.count)
            }
            do { try file.write(from: buffer) } catch {
                throw NativeFailure.decodeFailed(
                    "Cannot write audio: \(error.localizedDescription)")
            }
        }
    }
    func finish() throws -> Int {
        file = nil
        return try destination.finish()
    }
    func discard() {
        file = nil
        destination.discard()
    }
}
