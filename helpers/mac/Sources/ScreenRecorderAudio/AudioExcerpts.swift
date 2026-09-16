@preconcurrency import AVFoundation
import Foundation

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
            bytes: bytes, spans: request.spans, tracks: stream.reports)
    }
}

/// Lossless sink shared with the internal streaming proof. Consumption finishes before publication.
public enum AudioWave {
    public static func write(_ stream: AudioPCMStream, to output: URL) async throws -> Int {
        let destination = output.resolvingSymlinksInPath().standardizedFileURL
        guard !stream.sourceURLs.contains(destination) else {
            throw AudioFailure("INVALID_OUTPUT", "Excerpt output would overwrite the source media.")
        }
        var directory: ObjCBool = false
        if FileManager.default.fileExists(atPath: output.path, isDirectory: &directory),
            directory.boolValue
        {
            throw AudioFailure("INVALID_OUTPUT", "Excerpt output is an existing directory.")
        }
        guard
            let format = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: Double(stream.format.sampleRate),
                channels: AVAudioChannelCount(stream.format.channels), interleaved: true)
        else {
            throw AudioFailure("NATIVE_DECODE_FAILED", "Cannot describe audio output format.")
        }
        let staging = output.deletingLastPathComponent().appendingPathComponent(
            ".\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: staging) }
        do {
            // Scope closes the WAVE header before the file becomes visible to its consumer.
            do {
                let file = try AVAudioFile(
                    forWriting: staging, settings: format.settings,
                    commonFormat: .pcmFormatFloat32, interleaved: true)
                try await stream.consume { block in
                    try autoreleasepool {
                        guard
                            let buffer = AVAudioPCMBuffer(
                                pcmFormat: format,
                                frameCapacity: AVAudioFrameCount(block.frameCount))
                        else {
                            throw AudioFailure(
                                "NATIVE_DECODE_FAILED", "Cannot allocate WAVE block.")
                        }
                        buffer.frameLength = AVAudioFrameCount(block.frameCount)
                        block.samples.withUnsafeBufferPointer {
                            buffer.floatChannelData![0].update(
                                from: $0.baseAddress!, count: $0.count)
                        }
                        try file.write(from: buffer)
                    }
                }
            }
            try Task.checkCancellation()
            try? FileManager.default.removeItem(at: output)
            try FileManager.default.moveItem(at: staging, to: output)
            return try FileManager.default.attributesOfItem(atPath: output.path)[.size] as! Int
        } catch is CancellationError { throw CancellationError() } catch let failure as AudioFailure
        { throw failure } catch {
            throw AudioFailure(
                "NATIVE_DECODE_FAILED", "Cannot write audio: \(error.localizedDescription)")
        }
    }
}
