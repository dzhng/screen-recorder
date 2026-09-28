@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderFrames
import ScreenRecorderMedia

/// One shared compiler binding feeds both media planes. PCM stays streamed into the existing mux.
enum CompositionMovieOperation {
    private struct AudioSchedule: Codable {
        let range: CompositionAudioPlan.Samples
        let clips: [CompositionAudioPlan.Clip]
    }
    struct EncodedAudio: Encodable {
        let sampleRate: Int
        let channels: Int
        let durationValue: Int64
        let durationTimescale: Int32
    }
    struct Result: Encodable {
        let file: String
        let mediaType = "video/mp4"
        let codec = "h264"
        let settings: OutputSettings
        let encodedVideo: OutputSettings.EncodedVideo
        let durationUs: Int64
        let width: Int
        let height: Int
        let frameCount: Int
        let audio: CompositionAudioReport?
        let encodedAudio: EncodedAudio?
        let bytes: Int
    }
    static func execute(_ params: [String: Any]) async throws -> Result {
        guard let audioObject = params["audio"] as? [String: Any] else {
            throw NativeFailure("INVALID_REQUEST", "A compiled audio schedule is required.")
        }
        let schedule = try WireRequest.decode(AudioSchedule.self, from: audioObject)
        let request = try WireRequest.decode(
            CompositionVideoRenderer.Request.self,
            from: params.filter { $0.key != "audio" })
        try WireRequest.requireAbsolute(request.output, request.frames)
        for asset in request.assets { try WireRequest.requireAbsolute(asset.path) }
        func sample(_ us: Int64) -> Int64 { Int64(Int128(us) * 48_000 / 1_000_000) }
        guard schedule.range.start == sample(request.range.startUs),
            schedule.range.end == sample(request.range.endUs)
        else {
            throw NativeFailure(
                "INVALID_REQUEST", "Audio and video windows must share one project range.")
        }
        try request.validateOutput(hasAudio: schedule.range.start != schedule.range.end)
        let audio: CompositionAudio.Stream?
        if schedule.range.start == schedule.range.end {
            guard schedule.clips.isEmpty else {
                throw NativeFailure(
                    "INVALID_REQUEST", "A zero-sample window cannot contain audio records.")
            }
            audio = nil
        } else {
            audio = try await CompositionAudio.open(
                .init(
                    output: request.output,
                    range: schedule.range, clips: schedule.clips,
                    processing: request.processing, assets: request.assets))
        }
        let output = try NewFile(at: request.output, assembledAs: "movie.mp4")
        defer { output.discard() }
        let video = audio == nil ? output.url : output.scratch(named: "video.mp4")
        let records = try CompositionVideoOperation.FrameRecords(request.frames)
        defer { records.close() }
        let rendered = try await CompositionVideoRenderer.write(
            request.replacingOutput(video.path), nextFrame: records.next)
        if let audio {
            try await MovieMux.write(
                video: video, audio: audio, durationUs: rendered.durationUs, output: output.url,
                settings: request.settings.audio)
        }
        let movie = AVURLAsset(url: output.url)
        let duration = try await movie.load(.duration)
        var encodedAudio: EncodedAudio?
        if let track = try await movie.loadTracks(withMediaType: .audio).first,
            let description = try await track.load(.formatDescriptions).first,
            let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(description)
        {
            let rate = Int(asbd.pointee.mSampleRate)
            let channels = Int(asbd.pointee.mChannelsPerFrame)
            guard rate == request.settings.audio.sampleRate,
                channels == request.settings.audio.channels
            else {
                throw NativeFailure.decodeFailed(
                    "Encoder changed requested AAC sample rate or layout")
            }
            let span = try await track.load(.timeRange)
            encodedAudio = EncodedAudio(
                sampleRate: rate, channels: channels, durationValue: span.duration.value,
                durationTimescale: span.duration.timescale)
        }
        guard
            CMTimeCompare(duration, CMTime(value: rendered.durationUs, timescale: 1_000_000)) == 0
        else {
            throw NativeFailure.decodeFailed("Assembled composition changed the pinned duration.")
        }
        try Task.checkCancellation()
        let bytes = try output.publish()
        return Result(
            file: request.output, settings: request.settings, encodedVideo: rendered.encodedVideo,
            durationUs: rendered.durationUs,
            width: rendered.width, height: rendered.height, frameCount: rendered.frames,
            audio: audio?.report, encodedAudio: encodedAudio, bytes: bytes)
    }
}
