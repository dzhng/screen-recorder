@preconcurrency import AVFoundation
import Foundation

/// Video-only companion to CaptureWriter; never writes or publishes audio.
package final class ProbeCameraWriter {
    private let directory: URL
    private let framesPerSecond: Int
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var journal: CaptureJournal?
    private var first: Int64?
    private var end: Int64 = 0
    private var endTime: CMTime?
    private var frames = 0
    private var dropped = 0
    private var omitted = 0
    private var width = 0
    private var height = 0
    private var format: CMFormatDescription?
    private var pausedCount = 0
    private var origin: Int64?

    package init(directory: URL, framesPerSecond: Int) throws {
        self.directory = directory; self.framesPerSecond = framesPerSecond
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    }
    package func append(_ sample: CMSampleBuffer, state: CaptureWriter.IngressState) throws -> (receipt: CaptureWriter.IngressReceipt, frame: ProbeCameraFrame?) {
        guard state.accepting else { return (.init(disposition: "sealed-or-failed", sourceUs: nil), nil) }
        let host = CMTimeConvertScale(sample.presentationTimeStamp, timescale: 1_000_000, method: .roundHalfAwayFromZero).value
        let duration = sample.duration.isNumeric && sample.duration > .zero
            ? sample.duration : CMTime(value: 1, timescale: Int32(framesPerSecond))
        let durationUs = CMTimeConvertScale(duration, timescale: 1_000_000, method: .roundHalfAwayFromZero).value
        guard let source = state.clock.sourceTime(for: host, durationUs: durationUs) else {
            omitted += 1; return (.init(disposition: "outside-support", sourceUs: nil), nil)
        }
        guard sample.isValid, CMSampleBufferDataIsReady(sample), sample.imageBuffer != nil,
            let description = sample.formatDescription else {
            throw CaptureFailure("INVALID_CAMERA_FRAME", "Camera callback lacks usable video.")
        }
        if let format, !CMFormatDescriptionEqual(format, otherFormatDescription: description) {
            throw CaptureFailure("CAMERA_FORMAT_CHANGED", "Selected camera format changed during the take.")
        }
        if writer == nil {
            format = description
            let size = CMVideoFormatDescriptionGetDimensions(description)
            width = Int(size.width); height = Int(size.height)
            let journal = try CaptureJournal(directory: directory.path,
                header: CaptureJournalHeader(schemaVersion: 1, sessionID: UUID().uuidString,
                    source: CaptureSource(kind: "probe-camera"), width: width, height: height,
                    microphone: false, systemAudio: false))
            self.journal = journal
            origin = state.clock.originUs
            try journal.recordOrigin(hostUs: origin!, placedPauses: state.clock.pauses)
            pausedCount = state.clock.pauses.count
            let writer = try AVAssetWriter(outputURL: directory.appendingPathComponent("camera.raw.mov"), fileType: .mov)
            self.writer = writer
            writer.movieTimeScale = 1_000_000
            writer.movieFragmentInterval = CMTime(value: 5, timescale: 1)
            writer.initialMovieFragmentInterval = CMTime(value: 1, timescale: 1)
            let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [AVVideoExpectedSourceFrameRateKey: framesPerSecond,
                    AVVideoMaxKeyFrameIntervalKey: framesPerSecond]], sourceFormatHint: description)
            self.input = input
            input.mediaTimeScale = 1_000_000; input.expectsMediaDataInRealTime = true
            guard writer.canAdd(input) else { throw CaptureFailure("ENCODER_UNAVAILABLE", "Cannot encode camera video.") }
            writer.add(input)
            guard writer.startWriting() else { throw writer.error ?? CaptureFailure("WRITE_FAILED", "Camera writer failed.") }
            writer.startSession(atSourceTime: .zero)
        }
        try synchronizePauses(state.clock)
        guard let input, input.isReadyForMoreMediaData else {
            dropped += 1; return (.init(disposition: "backpressure", sourceUs: nil), nil)
        }
        // Subtract the common integer origin/pause shift before comparing rational frame endpoints.
        let sourceTime = CMTimeSubtract(sample.presentationTimeStamp, CMTime(value: host - source, timescale: 1_000_000))
        guard sourceTime >= .zero, endTime == nil || sourceTime >= endTime! else {
            omitted += 1; return (.init(disposition: "overlapping-or-reordered", sourceUs: nil), nil)
        }
        let retimed = try ProbeClockIngress.retime(sample, to: sourceTime, duration: duration)
        guard input.append(retimed) else { throw writer?.error ?? CaptureFailure("WRITE_FAILED", "Camera append failed.") }
        if first == nil {
            first = source
            try journal?.recordTrackStarted(role: "video", file: "video.mov", firstSourceUs: source,
                sampleRate: nil, channelCount: nil)
        }
        let frame = ProbeCameraFrame(ordinal: frames, start: ProbeTime(sourceTime), end: ProbeTime(CMTimeAdd(sourceTime, duration)))
        endTime = frame.end.time
        end = CMTimeConvertScale(endTime!, timescale: 1_000_000, method: .roundHalfAwayFromZero).value
        frames += 1
        return (.init(disposition: "accepted", sourceUs: source), frame)
    }
    private func synchronizePauses(_ clock: CaptureClock) throws {
        guard let origin else { return }
        while pausedCount < clock.pauses.count {
            let pause = clock.pauses[pausedCount]
            let earlier = clock.pauses.prefix(pausedCount).reduce(Int64(0)) { $0 + $1.elapsedPauseUs }
            let begin = origin + pause.atSourceUs + earlier
            try journal?.recordPauseBegan(hostUs: begin)
            try journal?.recordPauseEnded(hostUs: begin + pause.elapsedPauseUs, pause: pause)
            pausedCount += 1
        }
    }
    package func finish(clock: CaptureClock, failure: CaptureFailure?, observations: URL) async -> CaptureFailure? {
        var reason = failure
        var publication: ProbeCameraMedia.Receipt?
        do {
            try synchronizePauses(clock)
            if let writer, let input, frames > 0 {
                writer.endSession(atSourceTime: CMTime(value: end, timescale: 1_000_000))
                input.markAsFinished()
                await writer.finishWriting()
                guard writer.status == .completed else { throw writer.error ?? CaptureFailure("WRITE_FAILED", "Camera closure failed.") }
                try ProbeCameraMedia.recordClosed(raw: directory.appendingPathComponent("camera.raw.mov"), marker: directory.appendingPathComponent("camera.closed.json"))
            } else {
                writer?.cancelWriting()
                throw CaptureFailure("NO_CAMERA", "Selected camera delivered no accepted frames.")
            }
        } catch { reason = reason ?? (error as? CaptureFailure) ?? CaptureFailure("WRITE_FAILED", error.localizedDescription) }
        if let journal, frames > 0 {
            do {
                publication = try await ProbeCameraMedia.publish(lease: journal.lease, observationURL: observations)
                if let publication, !publication.diagnostics.isEmpty {
                    reason = reason ?? CaptureFailure("PARTIAL_CAMERA", publication.diagnostics.joined(separator: ", "))
                }
            } catch { reason = reason ?? (error as? CaptureFailure) ?? CaptureFailure("CAMERA_PUBLICATION_FAILED", error.localizedDescription) }
        }
        let result = CaptureResult(state: reason == nil ? "complete" : "interrupted",
            source: CaptureSource(kind: "probe-camera"), width: width, height: height,
            durationUs: publication?.endUs ?? 0, hostOriginUs: clock.originUs, pauses: clock.pauses,
            tracks: publication.map { [CapturedTrack(role: "video", file: "video.mov", firstSampleUs: $0.firstUs,
                lastSampleEndUs: $0.endUs, samples: $0.representedFrames, droppedSamples: dropped,
                omittedSamples: omitted, heldTailUs: 0, sampleRate: nil, channelCount: nil)] } ?? [], failure: reason,
            systemAudioScope: "disabled")
        do {
            try journal?.recordFinished(result)
            try JSONEncoder().encode(result).write(to: directory.appendingPathComponent("capture-result.json"), options: .atomic)
        } catch { reason = reason ?? CaptureFailure("JOURNAL_FAILED", error.localizedDescription) }
        journal?.lease.release()
        return reason
    }
    package func discard() {
        writer?.cancelWriting()
        journal?.lease.release()
    }
}
