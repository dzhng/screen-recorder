@preconcurrency import AVFoundation
import CoreGraphics
import Foundation
@preconcurrency import ScreenCaptureKit

@MainActor
public final class NativeCapture {
    private var input: (any CaptureInputSession)?
    private let prepareInput: @MainActor (CaptureRequest, @MainActor () throws -> Void) async throws -> any CaptureInputSession
    private var generations = CaptureGeneration()
    private var sink: CaptureWriter?
    private var closedResult: CaptureResult?
    private var closedCamera: ClosedCameraSource?
    private var publicationCancellationRequested = false
    private let termination = CaptureTermination<CaptureResult?>()
    public var onInterruption: ((CaptureFailure) -> Void)?
    private var failure: CaptureFailure?
    private enum State: String { case idle, selecting, recording, paused, finalizing }
    private var state = State.idle
    /// The device state this session is in. Only this type changes it.
    public var deviceState: String { state.rawValue }
    /// Output pixel dimensions of the running take, fixed when streaming began. A moved or resized
    /// source never changes them.
    public private(set) var outputSize: (width: Int, height: Int)?
    /// The journal sequence of the transition this take last recorded. The journal numbers these,
    /// so whoever stores them stores the take's own numbering rather than inventing a second one.
    public private(set) var lifecycleSequence: Int?

    /// The playback time the running take has reached, from its own capture clock. Nil when no
    /// take is capturing or none of its video has established source zero yet.
    public var elapsedSourceUs: Int64? { sink?.elapsedSourceUs() }

    public static var screenPermission: Bool { CGPreflightScreenCaptureAccess() }
    public static var microphonePermission: String { authorization(.audio) }
    public static var cameraPermission: String { authorization(.video) }

    private static func authorization(_ media: AVMediaType) -> String {
        switch AVCaptureDevice.authorizationStatus(for: media) {
        case .authorized: "authorized"
        case .denied: "denied"
        case .restricted: "restricted"
        case .notDetermined: "not_determined"
        @unknown default: "unknown"
        }
    }

    /// Discovery preserves native device order and never chooses or activates a camera.
    public static func cameraDevices() -> [CaptureVideoDevice] {
        cameraCandidates().map { CaptureVideoDevice(id: $0.uniqueID, name: $0.localizedName) }
    }

    package static func cameraCandidates() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external, .continuityCamera],
            mediaType: .video, position: .unspecified).devices
    }

    /// Every microphone a take could be asked to narrate through. Enumeration alone reaches no
    /// device and requests no authorization; an unauthorized microphone is refused when a take
    /// asks for it, not when a menu lists what exists.
    public static func microphoneDevices() -> [CaptureAudioDevice] {
        let preferred = AVCaptureDevice.default(for: .audio)?.uniqueID
        return ScreenCaptureInput.microphoneCandidates().map {
            CaptureAudioDevice(
                id: $0.uniqueID, name: $0.localizedName, isDefault: $0.uniqueID == preferred)
        }
    }

    public static func requestPermission(_ kind: String) async throws -> Bool {
        switch kind {
        case "screen": return CGRequestScreenCaptureAccess()
        case "microphone": return await AVCaptureDevice.requestAccess(for: .audio)
        default: throw CaptureFailure("INVALID_REQUEST", "Permission must be screen or microphone.")
        }
    }

    public init() { prepareInput = { request, check in try await CaptureInputPreparation().prepare(request, checkInterruption: check) } }

    package init(prepareInput: @escaping @MainActor (CaptureRequest, @MainActor () throws -> Void) async throws -> any CaptureInputSession) {
        self.prepareInput = prepareInput
    }

    public func start(_ request: CaptureRequest) async throws {
        guard state == .idle, !termination.isRunning else {
            throw CaptureFailure("INVALID_STATE", "Capture is already active.")
        }
        closedResult = nil
        publicationCancellationRequested = false
        let generation = generations.begin()
        state = .selecting
        failure = nil
        func checkStartup() throws {
            try Task.checkCancellation()
            guard generations.accepts(generation), state == .selecting else { throw CancellationError() }
            if let failure { throw failure }
        }
        defer {
            if state == .selecting, generations.accepts(generation) {
                state = .idle
                generations.end(generation)
            }
        }
        let prepared = try await prepareInput(request, checkStartup)
        do { try checkStartup() }
        catch {
            // Preparation has not acquired take ownership. Release only its returned resources.
            _ = await prepared.stop()
            await prepared.discardMedia()
            throw error
        }
        let width = prepared.width
        let height = prepared.height
        let onFailure: @Sendable (CaptureFailure) -> Void = { [weak self] reason in
            Task { @MainActor in self?.interrupt(reason, generation: generation) }
        }
        let writer: CaptureWriter
        do {
            writer = try CaptureWriter(request: request, width: width, height: height,
                sessionID: request.sourceId ?? generation.uuidString,
                requestedSourceRect: prepared.requestedSourceRect, onFailure: onFailure)
        } catch {
            _ = await prepared.stop()
            await prepared.discardMedia()
            throw error
        }
        outputSize = (width, height)
        var started = false
        defer {
            if !started {
                writer.cancel()
                if generations.accepts(generation) { input = nil }
            }
        }
        sink = writer
        input = prepared
        do {
            try await prepared.start(writer: writer, output: writer, framesPerSecond: nil,
                onFailure: onFailure, checkInterruption: checkStartup)
            try checkStartup()
        } catch {
            // Startup rollback joins an already-owned discard; it cannot drain an input twice
            // or clear a later generation after that discard finishes.
            if generations.accepts(generation) {
                _ = try? await termination.run { [self] in
                    guard generations.accepts(generation), input != nil else { return nil }
                    _ = await prepared.stop()
                    await prepared.discardMedia()
                    input = nil
                    sink = nil
                    outputSize = nil
                    generations.end(generation)
                    state = .idle
                    return nil
                }
            }
            throw (error as? CaptureFailure) ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription)
        }
        state = .recording
        started = true
        prepared.startCursorSampling(writer: writer)
        lifecycleSequence = writer.note("recording", reason: nil)
        prepared.observeDeviceLoss(onFailure: onFailure)
    }

    /// Records one reported transition in the running take's journal. The caller reports what the
    /// device did; this never decides a transition of its own.
    @discardableResult
    public func note(_ state: String, reason: String? = nil) -> Int? {
        lifecycleSequence = sink?.note(state, reason: reason)
        return lifecycleSequence
    }

    public func pause() throws {
        guard let sink, failure == nil, state == .recording || state == .paused else {
            throw CaptureFailure("INVALID_STATE", "No healthy capture is active.")
        }
        if state == .recording {
            sink.pause()
            state = .paused
        }
    }

    public func resume() throws {
        guard let sink, failure == nil, state == .recording || state == .paused else {
            throw CaptureFailure("INVALID_STATE", "No healthy capture is active.")
        }
        if state == .paused {
            sink.resume()
            state = .recording
        }
    }

    /// Publication remembers cancellation even while encoder closure is in flight.
    /// Transport waiters do not cancel shared work; legacy encoder finish keeps its existing winner.
    public func cancelPublication() {
        if sink?.packedJournalLease != nil || input != nil || closedCamera != nil {
            if termination.isRunning { termination.requestCancellation() }
            else { publicationCancellationRequested = true }
        }
    }

    public func stop() async throws -> CaptureResult {
        guard state != .selecting else { throw CaptureFailure("INVALID_STATE", "No capture is ready to stop.") }
        let task = termination.start { [self] in
            guard let sink, let generation = generations.current,
                state == .recording || state == .paused || state == .finalizing
            else { throw CaptureFailure("INVALID_STATE", "No capture is ready to stop.") }
            state = .finalizing
            if closedResult == nil {
                sink.seal()
                let inputFailure = await input?.stop()
                failure = failure ?? inputFailure
                let finished = await sink.finish(failure: failure)
                let finalClock = sink.queue.sync { sink.ingressState.clock }
                // Publication cancellation cannot interrupt physical encoder closure or its snapshot.
                let closingInput = input
                let companion = await Task { @MainActor in
                    await closingInput?.closeMedia(clock: finalClock, failure: finished.failure)
                }.value
                closedCamera = companion?.camera
                closedResult = finished.withFailure(companion?.failure)
                input = nil
            }
            guard let closedResult else { throw CaptureFailure("INVALID_STATE", "Writer did not close.") }
            var camera: CapturedCameraSource?
            var publicationError: (any Error)?
            if let closedCamera {
                do { camera = try await CameraMedia.publish(closedCamera) }
                catch { publicationError = error }
            }
            var result = closedResult
            do { result = try await publish(closedResult, from: sink) }
            catch { publicationError = publicationError ?? error }
            if let publicationError { throw publicationError }
            result = result.withCamera(camera)
            if sink.packedJournalLease != nil { result = sink.recordPublishedResult(result) }
            lifecycleSequence = sink.note(result.state,
                reason: result.failure?.code ?? (result.cleanupFailure == nil ? nil : "CLEANUP_PENDING"))
            outputSize = nil
            self.sink = nil
            self.closedResult = nil
            closedCamera?.releaseJournal()
            closedCamera = nil
            generations.end(generation)
            sink.releaseJournal()
            state = .idle
            return result
        }
        if publicationCancellationRequested {
            publicationCancellationRequested = false
            termination.requestCancellation()
        }
        let result = try await task.value
        guard let result else { throw CaptureFailure("INVALID_STATE", "The take was discarded.") }
        return result
    }

    private func publish(_ closed: CaptureResult, from sink: CaptureWriter) async throws -> CaptureResult {
        guard let lease = sink.packedJournalLease else { return closed }
        try Task.checkCancellation()
        var receipts: [CaptureAudioPublication.Receipt] = []
        var unavailable: [String] = []
        var publicationFailure: CaptureFailure?
        var retryFailure: (any Error)?
        for role in sink.requestedAudioRoles {
            guard closed.tracks.contains(where: { $0.role == role && $0.samples > 0 }) else {
                unavailable.append(role)
                continue
            }
            do {
                switch try await CaptureAudioPublication.publish(lease: lease, role: role) {
                case .published(let receipt): receipts.append(receipt)
                case .unavailable: unavailable.append(role)
                }
            } catch {
                try Task.checkCancellation()
                try lease.check()
                let failure = CaptureFinalizationError(error)
                if !failure.retryable {
                    publicationFailure = publicationFailure ?? CaptureFailure(failure.code, "\(role): \(failure.message)")
                } else {
                    retryFailure = retryFailure ?? error
                }
            }
        }
        if let retryFailure { throw retryFailure }
        // All requested represented media has now crossed its publication boundary. Cancellation
        // of optional cleanup must return this settled result, never make it discardable again.
        var cleanupFailure: CaptureFailure?
        for receipt in receipts {
            do { try await CaptureAudioPublication.cleanup(lease: lease, receipt: receipt) }
            catch {
                cleanupFailure = cleanupFailure ?? CaptureFailure("CLEANUP_PENDING", error.localizedDescription)
            }
        }
        let partial = receipts.first { $0.diagnostic != nil || $0.representedFrames != $0.acceptedFrames }
        let failure = closed.failure ?? publicationFailure ?? partial.map {
            CaptureFailure("AUDIO_PUBLICATION_PARTIAL", "\($0.intent.role) retains unresolved audio: \($0.diagnostic ?? "unrepresented accepted frames").")
        } ?? (unavailable.isEmpty ? nil : CaptureFailure("AUDIO_UNAVAILABLE",
            "Requested audio has no verified playable frames: \(unavailable.joined(separator: ", "))."))
        let roles = Set(receipts.map { $0.intent.role })
        let tracks = closed.tracks.map { track in
            CapturedTrack(role: track.role, file: roles.contains(track.role) ? "\(track.role).mov" : track.file,
                firstSampleUs: track.firstSampleUs, lastSampleEndUs: track.lastSampleEndUs,
                samples: track.samples, droppedSamples: track.droppedSamples,
                omittedSamples: track.omittedSamples, heldTailUs: track.heldTailUs,
                sampleRate: track.sampleRate, channelCount: track.channelCount)
        }
        return CaptureResult(state: failure == nil ? "complete" : "interrupted", source: closed.source,
            width: closed.width, height: closed.height, durationUs: closed.durationUs,
            hostOriginUs: closed.hostOriginUs, pauses: closed.pauses, tracks: tracks,
            failure: failure, systemAudioScope: closed.systemAudioScope, cursor: closed.cursor,
            cleanupFailure: cleanupFailure)
    }

    /// Ends a take whose media is being thrown away. The writers are canceled rather than
    /// finalized, so no partial file is left claiming to be a recording.
    public func discard() async {
        _ = try? await termination.run { [self] in
            guard let generation = generations.current, state != .idle else { return nil }
            if state == .selecting, sink == nil {
                generations.end(generation)
                outputSize = nil
                failure = nil
                state = .idle
                return nil
            }
            guard let sink else { return nil }
            state = .finalizing
            if closedResult == nil { sink.cancel() }
            _ = await input?.stop()
            await input?.discardMedia()
            input = nil
            outputSize = nil
            self.sink = nil
            closedResult = nil
            closedCamera?.releaseJournal()
            closedCamera = nil
            generations.end(generation)
            sink.releaseJournal()
            state = .idle
            return nil
        }
    }

    private func interrupt(_ reason: CaptureFailure, generation: UUID) {
        guard generations.accepts(generation), sink != nil, failure == nil else { return }
        failure = reason
        sink?.seal()
        // Sealing rejects samples immediately. The notified owner ends this take through the
        // same stop/discard operation; interruption must not retain a second stream teardown.
        onInterruption?(reason)
    }
}
