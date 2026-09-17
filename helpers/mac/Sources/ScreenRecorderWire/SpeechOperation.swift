import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia
import ScreenRecorderSpeech

/// The core plans the narration track and resolves the pinned model files and the attempt's output
/// path before calling this worker. Everything the request names is checked before a model loads.
enum SpeechOperation {
    private struct Request: Codable {
        let models: SpeechModelFiles
        let track: AudioTrackPlan
        let output: String
    }

    static func transcribe(_ params: [String: Any]) async throws -> SpeechTranscript {
        let request = try WireRequest.decode(Request.self, from: params)
        try WireRequest.requireAbsolute(request.models.directory, request.track.source, request.output)
        return try await divertingStandardOutput {
            try await NarrationTranscript.write(
                models: request.models, track: request.track, output: request.output)
        }
    }

    /// Standard output is this worker's response channel, but Core ML's runtime prints diagnostics
    /// to C `stdout`, buffered until exit, which would land beside the response. While the engine
    /// lives, descriptor 1 names standard error; buffered text is flushed there before the channel
    /// is restored. The operation takes no inherited descriptors, and the worker serves one request
    /// at a time, so the temporary duplicate cannot be mistaken for one.
    private static func divertingStandardOutput<Value>(_ work: () async throws -> Value)
        async throws -> Value
    {
        fflush(stdout)
        let channel = fcntl(STDOUT_FILENO, F_DUPFD_CLOEXEC, 0)
        guard channel >= 0, dup2(STDERR_FILENO, STDOUT_FILENO) >= 0 else {
            if channel >= 0 { close(channel) }
            throw NativeFailure(
                "TRANSCRIPTION_FAILED", "Cannot protect the response channel.", retryable: true)
        }
        defer {
            fflush(stdout)
            dup2(channel, STDOUT_FILENO)
            close(channel)
        }
        return try await work()
    }
}
