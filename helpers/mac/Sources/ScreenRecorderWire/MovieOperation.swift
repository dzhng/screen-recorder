@preconcurrency import AVFoundation
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
        /// Absent renders at the source's captured resolution; present bounds the rendition.
        let maxLongEdge: Int?
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
        try WireRequest.requireAbsolute(request.source)
        if let bound = request.maxLongEdge {
            guard bound > 0, bound <= FrameLimits.maximumLongEdge else {
                throw NativeFailure(
                    "INVALID_RANGE",
                    "Long edge \(bound) is outside 1...\(FrameLimits.maximumLongEdge) pixels.")
            }
        }
        let output = try NewFile(at: request.output, assembledAs: "movie.mp4")
        defer { output.discard() }
        let audio =
            request.tracks.isEmpty
            ? nil
            : try await AudioPCMStream.open(
                tracks: request.tracks,
                spans: request.plan.map {
                    TimeSpan(startUs: $0.source.startUs, endUs: $0.source.endUs)
                })
        let muxed = audio.map { $0.frames > 0 } ?? false
        let video = muxed ? output.scratch(named: "video.mp4") : output.url
        let rendered = try await VideoRenderer.write(
            source: URL(fileURLWithPath: request.source), plan: request.plan, into: video,
            pointerSchedule: request.pointerSchedule, maxLongEdge: request.maxLongEdge)
        if let audio, muxed {
            try await MovieMux.write(
                video: video, audio: audio, durationUs: rendered.durationUs, output: output.url)
            let duration = try await AVURLAsset(url: output.url).load(.duration)
            guard CMTimeCompare(duration, CMTime(value: rendered.durationUs, timescale: 1_000_000)) == 0
            else {
                throw NativeFailure.decodeFailed("Assembled movie changed the pinned duration.")
            }
        }
        let bytes = try output.publish()
        return Result(
            file: request.output, durationUs: rendered.durationUs, width: rendered.width,
            height: rendered.height, frameCount: rendered.frameCount,
            audio: audio.map {
                Audio(
                    codec: $0.frames > 0 ? "aac" : nil, frames: $0.frames,
                    sampleRate: $0.format.sampleRate, channels: $0.format.channels,
                    tracks: $0.reports)
            }, bytes: bytes)
    }
}
