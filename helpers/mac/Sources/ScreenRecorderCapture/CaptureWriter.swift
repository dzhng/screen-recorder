@preconcurrency import AVFoundation
import Foundation
@preconcurrency import ScreenCaptureKit

private func hostMicroseconds() -> Int64 {
    CMTimeConvertScale(
        CMClockGetTime(CMClockGetHostTimeClock()), timescale: 1_000_000,
        method: .roundHalfAwayFromZero
    ).value
}

private final class TrackWriter {
    let role: String
    let file: String
    let writer: AVAssetWriter
    let input: AVAssetWriterInput
    let sampleRate: Double?
    let channelCount: UInt32?
    var first: Int64?
    var end: Int64?
    var samples = 0
    var heldTailUs: Int64 = 0

    init(
        role: String, directory: String, settings: [String: Any], format: CMFormatDescription? = nil
    ) throws {
        self.role = role
        file = role == "video" ? "video.mov" : "\(role).mov"
        writer = try AVAssetWriter(
            outputURL: URL(fileURLWithPath: directory).appendingPathComponent(file), fileType: .mov)
        input = AVAssetWriterInput(
            mediaType: role == "video" ? .video : .audio, outputSettings: settings,
            sourceFormatHint: format)
        input.expectsMediaDataInRealTime = true
        sampleRate = format.flatMap {
            CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee.mSampleRate
        }
        channelCount = format.flatMap {
            CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee.mChannelsPerFrame
        }
        guard writer.canAdd(input) else {
            throw CaptureFailure("ENCODER_UNAVAILABLE", "Cannot encode \(role).")
        }
        writer.add(input)
        guard writer.startWriting() else {
            throw writer.error ?? CaptureFailure("WRITE_FAILED", "Cannot start \(role) writer.")
        }
        writer.startSession(atSourceTime: .zero)
    }
}

// All writer and clock mutations run on this queue, including control boundaries.
final class CaptureWriter: NSObject, SCStreamOutput, @unchecked Sendable {
    let queue = DispatchQueue(label: "com.david.screenrec.capture-writer")
    private let request: CaptureRequest
    private let width: Int
    private let height: Int
    private var clock = CaptureClock()
    private var tracks: [String: TrackWriter] = [:]
    private var dropped: [String: Int] = [:]
    private var omitted: [String: Int] = [:]
    private var stopHostUs: Int64?
    private let onFailure: @Sendable (CaptureFailure) -> Void
    private var failure: CaptureFailure?
    private var finishing = false
    private var lastVideo: CMSampleBuffer?

    init(
        request: CaptureRequest, width: Int, height: Int,
        onFailure: @escaping @Sendable (CaptureFailure) -> Void
    ) throws {
        self.onFailure = onFailure
        self.request = request
        self.width = width
        self.height = height
        try FileManager.default.createDirectory(
            atPath: request.outputDirectory, withIntermediateDirectories: true)
        tracks["video"] = try TrackWriter(
            role: "video", directory: request.outputDirectory,
            settings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoExpectedSourceFrameRateKey: 30, AVVideoMaxKeyFrameIntervalKey: 30,
                ],
            ])
    }

    func pause() { queue.sync { clock.pause(at: hostMicroseconds()) } }
    func resume() { queue.sync { clock.resume(at: hostMicroseconds()) } }
    func seal() {
        queue.sync {
            if stopHostUs == nil {
                stopHostUs = hostMicroseconds()
                finishing = true
            }
        }
    }
    func cancel() {
        queue.sync {
            finishing = true
            tracks.values.forEach { $0.writer.cancelWriting() }
        }
    }

    func stream(
        _ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard !finishing, failure == nil, sample.isValid, CMSampleBufferDataIsReady(sample) else {
            return
        }
        let role: String
        switch type {
        case .screen:
            role = "video"
            guard
                let attachments = CMSampleBufferGetSampleAttachmentsArray(
                    sample, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
                let status = attachments.first?[.status] as? Int,
                status == SCFrameStatus.complete.rawValue
                    || status == SCFrameStatus.started.rawValue,
                sample.imageBuffer != nil
            else { return }
        case .audio: role = "system"
        case .microphone: role = "narration"
        @unknown default: return
        }
        let pts = CMSampleBufferGetPresentationTimeStamp(sample)
        guard pts.isNumeric else { return }
        let hostUs = CMTimeConvertScale(pts, timescale: 1_000_000, method: .roundHalfAwayFromZero)
            .value
        if role == "video" {
            if clock.originUs == nil { clock.start(at: hostUs) }
        }
        let duration = CMSampleBufferGetDuration(sample)
        let observedDurationUs =
            duration.isNumeric
            ? max(
                0,
                CMTimeConvertScale(duration, timescale: 1_000_000, method: .roundHalfAwayFromZero)
                    .value) : 0
        let durationUs =
            observedDurationUs > 0 ? observedDurationUs : (role == "video" ? 33_333 : 0)
        guard let sourceUs = clock.sourceTime(for: hostUs, durationUs: durationUs) else {
            omitted[role, default: 0] += 1
            return
        }
        do {
            if tracks[role] == nil {
                guard let format = sample.formatDescription,
                    let audio = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee
                else {
                    throw CaptureFailure("INVALID_AUDIO_FORMAT", "Missing format for \(role).")
                }
                tracks[role] = try TrackWriter(
                    role: role, directory: request.outputDirectory,
                    settings: [
                        AVFormatIDKey: kAudioFormatLinearPCM,
                        AVSampleRateKey: audio.mSampleRate,
                        AVNumberOfChannelsKey: audio.mChannelsPerFrame,
                        AVLinearPCMBitDepthKey: 32,
                        AVLinearPCMIsFloatKey: true,
                        AVLinearPCMIsNonInterleaved: false,
                        AVLinearPCMIsBigEndianKey: false,
                    ], format: format)
            }
            guard let track = tracks[role] else { return }
            guard track.input.isReadyForMoreMediaData else {
                dropped[role, default: 0] += 1
                return
            }
            var count = 0
            var status = CMSampleBufferGetSampleTimingInfoArray(
                sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
            guard status == noErr else {
                throw CaptureFailure("RETIME_FAILED", "Cannot read sample timing: \(status).")
            }
            var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
            status = CMSampleBufferGetSampleTimingInfoArray(
                sample, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count)
            guard status == noErr else {
                throw CaptureFailure("RETIME_FAILED", "Cannot read sample timing: \(status).")
            }
            let offset = CMTimeSubtract(pts, CMTime(value: sourceUs, timescale: 1_000_000))
            for index in timing.indices {
                timing[index].presentationTimeStamp = CMTimeSubtract(
                    timing[index].presentationTimeStamp, offset)
                if timing[index].decodeTimeStamp.isNumeric {
                    timing[index].decodeTimeStamp = CMTimeSubtract(
                        timing[index].decodeTimeStamp, offset)
                }
            }
            var retimed: CMSampleBuffer?
            status = CMSampleBufferCreateCopyWithNewTiming(
                allocator: kCFAllocatorDefault, sampleBuffer: sample,
                sampleTimingEntryCount: timing.count, sampleTimingArray: &timing,
                sampleBufferOut: &retimed)
            guard status == noErr, let retimed else {
                throw CaptureFailure("RETIME_FAILED", "Cannot retime sample: \(status).")
            }
            guard track.input.append(retimed) else {
                throw track.writer.error
                    ?? CaptureFailure("WRITE_FAILED", "Cannot append \(role) sample.")
            }
            track.first = track.first ?? sourceUs
            track.end = max(track.end ?? 0, sourceUs + durationUs)
            track.samples += 1
            if role == "video" { lastVideo = retimed }
        } catch {
            let reason =
                (error as? CaptureFailure)
                ?? CaptureFailure("WRITE_FAILED", error.localizedDescription)
            failure = reason
            onFailure(reason)
        }
    }

    func finish(failure externalFailure: CaptureFailure?) async -> CaptureResult {
        await withCheckedContinuation { continuation in
            queue.async {
                self.finishing = true
                let endHost = self.stopHostUs ?? hostMicroseconds()
                self.clock.resume(at: endHost)
                let duration = max(0, self.clock.sourceTime(for: endHost) ?? 0)
                self.failure = externalFailure ?? self.failure
                if self.tracks["video"]?.samples == 0 {
                    self.failure =
                        self.failure
                        ?? CaptureFailure("NO_VIDEO", "Capture produced no usable video samples.")
                }
                if self.failure != nil {
                    self.finalize(
                        sourceDurationUs: min(duration, self.tracks["video"]?.end ?? 0),
                        continuation: continuation)
                } else if let video = self.tracks["video"], let last = self.lastVideo,
                    let end = video.end, duration > end
                {
                    self.holdTail(of: video, repeating: last, from: end, through: duration) {
                        settled in
                        self.finalize(sourceDurationUs: settled, continuation: continuation)
                    }
                } else {
                    self.finalize(sourceDurationUs: duration, continuation: continuation)
                }
            }
        }
    }

    /// Stretches a healthy take to its stop boundary by repeating the last delivered frame, and
    /// reports the source duration the file actually reached. A take that cannot keep its tail
    /// is interrupted and retains only its valid prefix.
    private func holdTail(
        of video: TrackWriter, repeating last: CMSampleBuffer, from lastSampleEndUs: Int64,
        through durationUs: Int64, then settle: @escaping (Int64) -> Void
    ) {
        let timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 30),
            presentationTimeStamp: CMTime(value: durationUs - 33_333, timescale: 1_000_000),
            decodeTimeStamp: .invalid)
        HeldTailFrame.place(
            last, at: timing, in: video.input, of: video.writer, on: queue
        ) { reason in
            guard reason == nil else {
                self.failure = reason
                settle(lastSampleEndUs)
                return
            }
            video.heldTailUs = durationUs - lastSampleEndUs
            settle(durationUs)
        }
    }

    private func finalize(
        sourceDurationUs: Int64, continuation: CheckedContinuation<CaptureResult, Never>
    ) {
        let group = DispatchGroup()
        for track in tracks.values {
            if track.samples == 0 {
                track.writer.cancelWriting()
                continue
            }
            track.writer.endSession(
                atSourceTime: CMTime(value: sourceDurationUs, timescale: 1_000_000))
            track.input.markAsFinished()
            group.enter()
            track.writer.finishWriting { group.leave() }
        }
        group.notify(queue: queue) {
            for track in self.tracks.values
            where track.samples > 0 && track.writer.status != .completed {
                self.failure =
                    self.failure
                    ?? CaptureFailure(
                        "WRITE_FAILED",
                        track.writer.error?.localizedDescription
                            ?? "Writer did not complete \(track.role).")
            }
            if self.request.microphone && (self.tracks["narration"]?.samples ?? 0) == 0 {
                self.failure =
                    self.failure
                    ?? CaptureFailure(
                        "NO_NARRATION",
                        "Microphone was requested but delivered no usable samples.")
            }
            if self.request.systemAudio && (self.tracks["system"]?.samples ?? 0) == 0 {
                self.failure =
                    self.failure
                    ?? CaptureFailure(
                        "NO_SYSTEM_AUDIO",
                        "System audio was requested but delivered no usable samples.")
            }
            let result = CaptureResult(
                state: self.failure == nil ? "complete" : "interrupted",
                source: self.request.source,
                width: self.width, height: self.height,
                durationUs: self.tracks["video"]?.samples == 0 ? 0 : sourceDurationUs,
                hostOriginUs: self.clock.originUs, pauses: self.clock.pauses,
                tracks: self.tracks.values.sorted { $0.role < $1.role }.map { track in
                    CapturedTrack(
                        role: track.role, file: track.file, firstSampleUs: track.first,
                        lastSampleEndUs: track.end, samples: track.samples,
                        droppedSamples: self.dropped[track.role, default: 0],
                        omittedSamples: self.omitted[track.role, default: 0],
                        heldTailUs: track.heldTailUs, sampleRate: track.sampleRate,
                        channelCount: track.channelCount)
                }, failure: self.failure,
                systemAudioScope: self.request.systemAudio
                    ? "whole-system-excluding-recorder" : "disabled"
            )
            continuation.resume(returning: result)
        }
    }
}
