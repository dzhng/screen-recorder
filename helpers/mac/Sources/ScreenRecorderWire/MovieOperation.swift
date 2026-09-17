@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderMedia

/// One native assembly operation; the service owns the enclosing attempt lifetime.
enum MovieOperation {
    private struct Request: Codable {
        let source: String
        let output: String
        let plan: [VideoRenderSpan]
        let tracks: [AudioTrackPlan]
        let pointerSchedule: PointerScheduleReceipt?
    }
    struct Result: Encodable {
        let file: String
        let mediaType = "video/mp4"
        let codec = "h264"
        let durationUs: Int64
        let width: Int
        let height: Int
        let frameCount: Int
        let audio: Audio?
        let bytes: Int
    }

    struct Audio: Encodable {
        let codec: String?
        let frames: Int64
        let sampleRate: Int
        let channels: Int
        let tracks: [AudioTrackReport]
    }

    static func execute(_ params: [String: Any]) async throws -> Result {
        let request = try WireRequest.decode(Request.self, from: params)
        let output = URL(fileURLWithPath: request.output)
        var info = stat()
        guard request.output.hasPrefix("/"), !request.output.contains("\0"),
            lstat(output.path, &info) != 0, errno == ENOENT
        else { throw NativeFailure("INVALID_OUTPUT", "Movie output must be a new absolute path.") }
        let staging = output.deletingLastPathComponent().appendingPathComponent(
            ".movie-render-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: staging) }
        let video = staging.appendingPathComponent("video.mp4")
        try WireRequest.requireAbsolute(request.source)
        let rendered = try await VideoRenderer.write(
            source: URL(fileURLWithPath: request.source), plan: request.plan, output: video,
            pointerSchedule: request.pointerSchedule)
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
            throw NativeFailure.decodeFailed("Assembled movie changed the pinned duration.")
        }
        let bytes = try FileManager.default.attributesOfItem(atPath: completed.path)[.size] as! Int
        guard link(completed.path, output.path) == 0 else {
            throw NativeFailure("INVALID_OUTPUT", "Movie destination appeared before publication.")
        }
        return Result(
            file: output.path, durationUs: rendered.durationUs, width: rendered.width,
            height: rendered.height, frameCount: rendered.frameCount,
            audio: audio.map {
                Audio(
                    codec: $0.frames > 0 ? "aac" : nil, frames: $0.frames,
                    sampleRate: $0.format.sampleRate, channels: $0.format.channels,
                    tracks: $0.reports)
            }, bytes: bytes)
    }
}
