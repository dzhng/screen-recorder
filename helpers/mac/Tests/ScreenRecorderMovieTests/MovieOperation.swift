@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames

/// Feasibility-only composition of the accepted native owners. No service route uses this.
enum MovieOperation {
    private struct Parameters: Decodable {
        let source: String
        let output: String
        let plan: [VideoRenderSpan]
        let tracks: [AudioTrackPlan]
    }
    struct Result: Encodable {
        let file: String
        let mediaType = "video/mp4"
        let videoCodec = "h264"
        let audioCodec: String?
        let durationUs: Int64
        let width: Int
        let height: Int
        let frameCount: Int
        let audioFrames: Int64
        let sampleRate: Int?
        let channels: Int?
        let tracks: [AudioTrackReport]
        let bytes: Int
    }

    static func execute(_ params: [String: Any]) async throws -> Result {
        guard Set(params.keys) == ["source", "output", "plan", "tracks"],
            let tracks = params["tracks"] as? [[String: Any]],
            tracks.allSatisfy({ Set($0.keys) == ["role", "source", "sourceOffsetUs", "available"] }
            ),
            tracks.allSatisfy({
                ($0["available"] as? [[String: Any]])?.allSatisfy {
                    Set($0.keys) == ["startUs", "endUs"]
                } ?? false
            })
        else { throw FrameFailure("INVALID_REQUEST", "Invalid media.renderMovie parameters.") }
        let request: Parameters
        do {
            request = try JSONDecoder().decode(
                Parameters.self, from: JSONSerialization.data(withJSONObject: params))
        } catch { throw FrameFailure("INVALID_REQUEST", "Invalid movie parameter types.") }
        let output = URL(fileURLWithPath: request.output)
        var info = stat()
        guard request.output.hasPrefix("/"), !request.output.contains("\0"),
            lstat(output.path, &info) != 0, errno == ENOENT
        else { throw FrameFailure("INVALID_OUTPUT", "Movie output must be a new absolute path.") }
        let staging = output.deletingLastPathComponent().appendingPathComponent(
            ".movie-render-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: staging) }
        let video = staging.appendingPathComponent("video.mp4")
        let rendered = try await VideoRenderer.write(
            source: URL(fileURLWithPath: request.source), plan: request.plan, output: video)
        let audio =
            request.tracks.isEmpty
            ? nil
            : try await AudioPCMStream.open(
                tracks: request.tracks,
                spans: request.plan.map {
                    SourceSpan(startUs: $0.source.startUs, endUs: $0.source.endUs)
                })
        var completed = video
        if let audio, audio.frames > 0 {
            completed = staging.appendingPathComponent("movie.mp4")
            try await MovieMux.write(
                video: video, audio: audio, durationUs: rendered.durationUs, output: completed)
        }
        try Task.checkCancellation()
        let duration = try await AVURLAsset(url: completed).load(.duration)
        guard CMTimeCompare(duration, CMTime(value: rendered.durationUs, timescale: 1_000_000)) == 0
        else {
            throw FrameFailure(
                "NATIVE_DECODE_FAILED", "Assembled movie changed the pinned duration.")
        }
        let bytes = try FileManager.default.attributesOfItem(atPath: completed.path)[.size] as! Int
        guard link(completed.path, output.path) == 0 else {
            throw FrameFailure("INVALID_OUTPUT", "Movie destination appeared before publication.")
        }
        return Result(
            file: output.path, audioCodec: (audio?.frames ?? 0) > 0 ? "aac" : nil,
            durationUs: rendered.durationUs, width: rendered.width, height: rendered.height,
            frameCount: rendered.frameCount, audioFrames: audio?.frames ?? 0,
            sampleRate: audio?.format.sampleRate, channels: audio?.format.channels,
            tracks: audio?.reports ?? [], bytes: bytes)
    }
}
