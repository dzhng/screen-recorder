@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames

/// One native assembly operation; the service owns the enclosing attempt lifetime.
enum MovieOperation {
    private struct Parameters: Decodable {
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
        guard
            Set(params.keys).subtracting(["pointerSchedule"]) == [
                "source", "output", "plan", "tracks",
            ],
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
        let rendered = try await VideoOperation.execute(
            [
                "source": request.source, "output": video.path, "plan": params["plan"]!,
            ], pointerSchedule: request.pointerSchedule)
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
