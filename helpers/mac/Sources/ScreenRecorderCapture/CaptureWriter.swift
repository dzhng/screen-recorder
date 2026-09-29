@preconcurrency import AVFoundation
import Foundation
import Synchronization
@preconcurrency import ScreenCaptureKit

private final class TrackWriter {
    let role: String
    let file: String
    let writer: AVAssetWriter
    let input: AVAssetWriterInput
    let sampleRate: Double?
    let channelCount: UInt32?
    let pcm: CapturePCM?
    var first: Int64?
    var end: Int64?
    var samples = 0
    var physicalFrames: Int64 = 0
    var heldTailUs: Int64 = 0

    init(
        role: String, directory: String, settings: [String: Any], format: CMFormatDescription? = nil
    ) throws {
        self.role = role
        pcm = try role == "video" ? nil : format.map { try CapturePCM(format: $0) }
        sampleRate = format.flatMap {
            CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee.mSampleRate
        }
        channelCount = format.flatMap {
            CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee.mChannelsPerFrame
        }
        file = role == "video" ? "video.mov" : "\(role).packed.mov"
        writer = try AVAssetWriter(
            outputURL: URL(fileURLWithPath: directory).appendingPathComponent(file), fileType: .mov)
        // Video endpoints use source-clock ticks; packed PCM endpoints use exact native frames.
        let timescale: Int32
        if role == "video" { timescale = 1_000_000 }
        else {
            guard let rate = sampleRate.flatMap({ Int32(exactly: $0) }), rate > 0 else {
                throw CaptureFailure("INVALID_AUDIO_FORMAT", "PCM rate cannot identify its native sample grid.")
            }
            timescale = rate
        }
        writer.movieTimeScale = timescale
        writer.movieFragmentInterval = CMTime(value: 5, timescale: 1)
        writer.initialMovieFragmentInterval = CMTime(value: 1, timescale: 1)
        input = AVAssetWriterInput(
            mediaType: role == "video" ? .video : .audio, outputSettings: settings,
            sourceFormatHint: pcm?.format ?? format)
        if role == "video" { input.mediaTimeScale = timescale }
        input.expectsMediaDataInRealTime = true
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
package final class CaptureWriter: NSObject, SCStreamOutput, @unchecked Sendable {
    package let queue = DispatchQueue(label: "com.david.screenrec.capture-writer")
    private let journal: CaptureJournal
    package var packedJournalLease: CaptureJournalLease? { journal.schemaVersion == 2 ? journal.lease : nil }
    package var requestedAudioRoles: [String] {
        (request.microphone ? ["narration"] : []) + (request.systemAudio ? ["system"] : [])
    }
    private let request: CaptureRequest
    private let width: Int
    private let height: Int
    private var clock = CaptureClock()
    /// A copy of the clock for readers outside this queue. Elapsed playback time is asked for while
    /// a take is being finalized, and finalization occupies the writer queue for as long as the
    /// media takes to close; a reader that waited for the queue would stall its own thread behind
    /// that work. The copy is refreshed whenever the clock's own boundaries move, which is the only
    /// thing that changes what elapsed time it reports.
    private let publishedClock = Mutex(CaptureClock())
    private var tracks: [String: TrackWriter] = [:]
    private var dropped: [String: Int] = [:]
    private var omitted: [String: Int] = [:]
    private var stopHostUs: Int64?
    private let onFailure: @Sendable (CaptureFailure) -> Void
    private var failure: CaptureFailure?
    private var finishing = false
    private var lastVideo: CMSampleBuffer?
    private let requestedSourceRect: CGRect?
    private var cursor = CursorTrack()
    private var sampler: CursorSampler?
    private var zeroOriginHeight: Double?

    package init(
        request: CaptureRequest, width: Int, height: Int, sessionID: String,
        requestedSourceRect: CGRect?, onFailure: @escaping @Sendable (CaptureFailure) -> Void
    ) throws {
        self.onFailure = onFailure
        self.request = request
        self.width = width
        self.height = height
        self.requestedSourceRect = requestedSourceRect
        try FileManager.default.createDirectory(
            atPath: request.outputDirectory, withIntermediateDirectories: true)
        journal = try CaptureJournal(
            directory: request.outputDirectory,
            header: CaptureJournalHeader(
                schemaVersion: 2, sessionID: sessionID, source: request.source, width: width,
                height: height,
                microphone: request.microphone, systemAudio: request.systemAudio))
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

    /// Pointer sampling exists only while a take is actually recording: a paused take stops the
    /// cadence instead of collecting readings its clock would then refuse.
    func startCursorSampling() {
        queue.sync {
            let sampler = CursorSampler(target: queue) { [weak self] reading in
                self?.accept(reading)
            }
            self.sampler = sampler
            sampler.start()
        }
    }

    package func pause() {
        queue.sync {
            sampler?.suspend()
            let hostUs = CaptureHostTime.nowUs()
            clock.pause(at: hostUs)
            publishClock()
            _ = record { try self.journal.recordPauseBegan(hostUs: hostUs) }
        }
    }
    package func resume() {
        queue.sync {
            resumeClock(at: CaptureHostTime.nowUs())
            if !finishing { sampler?.resume() }
        }
    }
    private func resumeClock(at hostUs: Int64) {
        let paused = clock.isPaused
        let count = clock.pauses.count
        clock.resume(at: hostUs)
        publishClock()
        if paused {
            let pause = clock.pauses.count > count ? clock.pauses.last : nil
            _ = record { try self.journal.recordPauseEnded(hostUs: hostUs, pause: pause) }
        }
    }
    private func record(_ write: () throws -> Void) -> Bool {
        do {
            try write()
            return true
        } catch {
            let reason = CaptureFailure("JOURNAL_FAILED", error.localizedDescription)
            if failure == nil {
                failure = reason
                onFailure(reason)
            }
            return false
        }
    }
    /// Records one reported transition in the take's journal and returns its sequence, so the
    /// number the service stores is the number this file carries.
    func note(_ state: String, reason: String?) -> Int? {
        queue.sync {
            var sequence: Int?
            _ = record { sequence = try self.journal.recordLifecycle(state: state, reason: reason) }
            return sequence
        }
    }
    /// The playback time this take holds right now, read from the one clock its media is written
    /// in. It is nil until video establishes source zero, and stops advancing while paused. It is
    /// answered from the published copy, so asking what time a take has reached never waits behind
    /// the take's own encoding or finalization.
    func elapsedSourceUs() -> Int64? {
        publishedClock.withLock { $0.elapsedSourceUs(at: CaptureHostTime.nowUs()) }
    }

    private func publishClock() {
        let current = clock
        publishedClock.withLock { $0 = current }
    }

    package func seal() {
        queue.sync {
            sampler?.stop()
            if stopHostUs == nil {
                let endpoint = CaptureHostTime.nowUs()
                stopHostUs = endpoint
                clock.seal(at: endpoint)
                publishClock()
                finishing = true
            }
            flushCursorSamples()
        }
    }
    package func cancel() {
        queue.sync {
            sampler?.stop()
            finishing = true
            tracks.values.forEach { $0.writer.cancelWriting() }
            journal.lease.release()
        }
    }
    package func releaseJournal() { queue.sync { journal.lease.release() } }

    /// Places one pointer reading in the take's source time. A reading the clock refuses, because
    /// the take is paused or has no source zero yet, is counted and dropped: no sample is invented
    /// for time the recording does not contain.
    package func accept(_ reading: CursorReading) {
        // A canceled sampler can still have deliveries queued behind seal/cancel.
        guard !finishing else { return }
        if zeroOriginHeight != reading.zeroOriginHeight {
            zeroOriginHeight = reading.zeroOriginHeight
            _ = record {
                try self.journal.recordDisplaySpace(
                    hostUs: reading.hostUs, zeroOriginHeight: reading.zeroOriginHeight)
            }
        }
        guard failure == nil,
            let batch = cursor.accept(reading, sourceUs: clock.sourceTime(for: reading.hostUs))
        else { return }
        _ = record { try self.journal.recordCursorSamples(batch) }
    }

    private func flushCursorSamples() {
        let remaining = cursor.seal()
        cursor.note(refusedReadings: sampler?.refusedReadings ?? 0)
        guard failure == nil, !remaining.isEmpty else { return }
        _ = record { try self.journal.recordCursorSamples(remaining) }
    }

    /// Follows the placement each delivered frame reports. Idle and blank frames still describe
    /// where the source is, so geometry follows them even though their pixels are not written; a
    /// moved or resized window keeps the same output dimensions.
    private func updateGeometry(
        from info: [SCStreamFrameInfo: Any], hostUs: Int64, durationUs: Int64, usable: Bool
    ) {
        guard
            let observed = CaptureGeometry(
                frameInfo: info, outputWidth: width, outputHeight: height,
                requestedSourceRect: requestedSourceRect)
        else { return }
        guard
            let event = cursor.observe(
                observed, hostUs: hostUs,
                sourceUs: clock.sourceTime(for: hostUs, durationUs: usable ? durationUs : 0),
                usable: usable
            )
        else { return }
        _ = record {
            try self.journal.recordGeometry(
                epoch: event.epoch, hostUs: event.hostUs, sourceUs: event.sourceUs,
                geometry: event.geometry)
        }
    }

    package func stream(
        _ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer,
        of type: SCStreamOutputType
    ) {
        guard !finishing, failure == nil, sample.isValid, CMSampleBufferDataIsReady(sample) else {
            return
        }
        let pts = CMSampleBufferGetPresentationTimeStamp(sample)
        guard pts.isNumeric else { return }
        let hostUs = CMTimeConvertScale(pts, timescale: 1_000_000, method: .roundHalfAwayFromZero)
            .value
        let duration = CMSampleBufferGetDuration(sample)
        let observedDurationUs =
            duration.isNumeric
            ? max(
                0,
                CMTimeConvertScale(duration, timescale: 1_000_000, method: .roundHalfAwayFromZero)
                    .value)
            : 0
        let durationUs =
            observedDurationUs > 0 ? observedDurationUs : (type == .screen ? 33_333 : 0)
        let role: String
        switch type {
        case .screen:
            role = "video"
            guard
                let attachments = CMSampleBufferGetSampleAttachmentsArray(
                    sample, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
                let info = attachments.first, let status = info[.status] as? Int
            else { return }
            let usable =
                (status == SCFrameStatus.complete.rawValue
                    || status == SCFrameStatus.started.rawValue) && sample.imageBuffer != nil
            // Source zero belongs to the first usable frame, so the geometry that frame reports is
            // placed at source zero rather than in the take's unplaceable prologue.
            if usable, clock.start(at: hostUs, durationUs: durationUs) {
                publishClock()
                guard record({
                    try self.journal.recordPCMOrigin(JournalPCMOrigin(rawPTS: pts, declaredHostUs: hostUs),
                        placedPauses: self.clock.pauses)
                }) else { return }
            }
            updateGeometry(from: info, hostUs: hostUs, durationUs: durationUs, usable: usable)
            guard usable else { return }
        case .audio: role = "system"
        case .microphone: role = "narration"
        @unknown default: return
        }
        guard var sourceUs = clock.sourceTime(for: hostUs, durationUs: role == "video" ? durationUs : 0) else {
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
            let sample = try track.pcm?.normalize(sample) ?? sample
            var endUs = sourceUs + durationUs
            var targetPTS = CMTime(value: sourceUs, timescale: 1_000_000)
            var prospectiveClock = clock
            var placement: CaptureClock.PCMPlacement?
            let physicalFirst = track.physicalFrames
            if role != "video" {
                guard let rate = track.sampleRate.flatMap({ Int32(exactly: $0) }), rate > 0 else {
                    throw CaptureFailure("INVALID_AUDIO_FORMAT", "PCM sample rate must identify its native sample grid.")
                }
                guard let admitted = try prospectiveClock.recordAcceptedPCM(
                    role: role, hostPTS: pts, frames: Int64(sample.numSamples), rate: rate) else {
                    omitted[role, default: 0] += 1
                    return
                }
                placement = admitted
                let timeline = try PCMContainerTime(phaseUs: admitted.anchorUs, rate: rate)
                sourceUs = CMTimeConvertScale(try timeline.time(at: admitted.firstFrame),
                    timescale: 1_000_000, method: .roundHalfAwayFromZero).value
                endUs = CMTimeConvertScale(try timeline.time(at: admitted.firstFrame + admitted.frames),
                    timescale: 1_000_000, method: .roundHalfAwayFromZero).value
                let physicalEnd = physicalFirst.addingReportingOverflow(admitted.frames)
                guard !physicalEnd.overflow else { throw CaptureFailure("INVALID_AUDIO_TIMING", "Physical PCM address overflow.") }
                targetPTS = CMTime(value: physicalFirst, timescale: rate)
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
            let offset = CMTimeSubtract(pts, targetPTS)
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
            let firstAppend = track.first == nil
            // Media acceptance cannot be rolled back if the following journal write fails.
            track.first = track.first ?? sourceUs
            track.end = max(track.end ?? 0, endUs)
            track.samples += 1
            if let placement {
                clock = prospectiveClock
                track.physicalFrames = physicalFirst + placement.frames
                publishClock()
                if firstAppend {
                    guard record({ try self.journal.recordPCMTrack(JournalPCMTrack(
                        role: role, rate: placement.rate, channels: track.channelCount!, phaseUs: placement.anchorUs)) }) else { return }
                }
                guard record({ try self.journal.recordPCMAppend(JournalPCMAppend(
                    role: role, physicalFirstFrame: physicalFirst, frameCount: placement.frames,
                    declaredFirstFrame: placement.firstFrame, rawPTS: pts, removedPauseUs: placement.removedPauseUs)) }) else { return }
            } else {
                lastVideo = retimed
                if firstAppend {
                    guard record({ try self.journal.recordTrackStarted(
                        role: role, file: track.file, firstSourceUs: sourceUs,
                        sampleRate: track.sampleRate, channelCount: track.channelCount) }) else { return }
                }
            }
        } catch {
            let reason =
                (error as? CaptureFailure)
                ?? CaptureFailure("WRITE_FAILED", error.localizedDescription)
            failure = reason
            onFailure(reason)
        }
    }

    package func finish(failure externalFailure: CaptureFailure?) async -> CaptureResult {
        await withCheckedContinuation { continuation in
            queue.async {
                self.finishing = true
                self.sampler?.stop()
                self.flushCursorSamples()
                let endHost = self.stopHostUs ?? CaptureHostTime.nowUs()
                self.resumeClock(at: endHost)
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
            let end = track.role == "video"
                ? CMTime(value: sourceDurationUs, timescale: 1_000_000)
                : CMTime(value: track.physicalFrames, timescale: Int32(track.sampleRate!))
            track.writer.endSession(atSourceTime: end)
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
                    ? "whole-system-excluding-recorder" : "disabled",
                cursor: self.cursor.stats
            )
            continuation.resume(returning: result)
        }
    }
    package func recordPublishedResult(_ result: CaptureResult) -> CaptureResult {
        queue.sync { recordFinished(result) }
    }

    private func recordFinished(_ result: CaptureResult) -> CaptureResult {
        guard !record({ try journal.recordFinished(result) }) else { return result }
        return CaptureResult(state: "interrupted", source: result.source, width: result.width,
            height: result.height, durationUs: result.durationUs, hostOriginUs: result.hostOriginUs,
            pauses: result.pauses, tracks: result.tracks, failure: failure,
            systemAudioScope: result.systemAudioScope, cursor: result.cursor,
            cleanupFailure: result.cleanupFailure)
    }

}
