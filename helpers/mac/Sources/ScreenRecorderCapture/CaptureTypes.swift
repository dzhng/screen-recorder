import Foundation
import Darwin
import ScreenRecorderMedia

public struct CaptureRegion: Codable, Sendable {
    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double
}

public struct CaptureSource: Codable, Sendable {
    public init(
        kind: String, displayID: UInt32? = nil, windowID: UInt32? = nil,
        region: CaptureRegion? = nil
    ) {
        self.kind = kind
        self.displayID = displayID
        self.windowID = windowID
        self.region = region
    }

    public let kind: String
    public let displayID: UInt32?
    public let windowID: UInt32?
    public let region: CaptureRegion?
}

public struct CaptureRequest: Codable, Sendable {
    public init(
        source: CaptureSource, outputDirectory: String, sourceId: String? = nil,
        microphone: Bool = false, microphoneDeviceID: String? = nil, systemAudio: Bool = false
    ) {
        self.source = source
        self.outputDirectory = outputDirectory
        self.sourceId = sourceId
        self.microphone = microphone
        self.microphoneDeviceID = microphoneDeviceID
        self.systemAudio = systemAudio
    }

    public var source: CaptureSource
    public let outputDirectory: String
    /// The capture-source identity the library allocated for this take, stamped into the journal
    /// so a source directory names the take it belongs to. Absent for a standalone probe run.
    public var sourceId: String?
    public let microphone: Bool
    public let microphoneDeviceID: String?
    public let systemAudio: Bool
}

/// One microphone a take can narrate through, as the device layer sees it.
public struct CaptureAudioDevice: Codable, Sendable, Equatable {
    public init(id: String, name: String, isDefault: Bool) {
        self.id = id
        self.name = name
        self.isDefault = isDefault
    }

    public let id: String
    public let name: String
    public let isDefault: Bool
}

/// A camera's discovery identity and display name; discovery supplies no default selection.
public struct CaptureVideoDevice: Codable, Sendable, Equatable {
    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
    public let id: String
    public let name: String
}

public struct CaptureFailure: Error, LocalizedError, Codable, Sendable {
    public var errorDescription: String? { message }
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}

/// The bounded diagnostic for an unfinished publication attempt, shared by control and recovery.
public struct CaptureFinalizationError: Codable, Sendable {
    public let code: String
    public let message: String
    public let retryable: Bool
    package static func isOperationalRead(_ error: any Error) -> Bool {
        var cause = error as NSError
        while true {
            if (cause.domain == NSCocoaErrorDomain && cause.code == CocoaError.fileReadNoPermission.rawValue)
                || (cause.domain == NSPOSIXErrorDomain && [EACCES, EPERM, EIO].contains { Int($0) == cause.code }) {
                return true
            }
            guard let underlying = cause.userInfo[NSUnderlyingErrorKey] as? NSError else { return false }
            cause = underlying
        }
    }
    public init(_ error: any Error) {
        let failure = error as? CaptureFailure
        let native = error as? NativeFailure
        let rawCode = failure?.code ?? native?.code ?? "PUBLICATION_FAILED"
        code = String(rawCode.prefix(128))
        message = String(decoding: (failure?.message ?? native?.message ?? error.localizedDescription).utf16.prefix(4096), as: UTF16.self)
        retryable = !["INVALID_REQUEST", "INVALID_JOURNAL", "INVALID_JOURNAL_PREFIX", "JOURNAL_CHANGED", "JOURNAL_CLOSED", "INVALID_MEDIA",
            "INVALID_AUDIO_TIMING", "PUBLICATION_CONFLICT", "PACKED_MEDIA_INVALID", "AUDIO_UNAVAILABLE",
            "NOT_REQUESTED", "EVIDENCE_LIMIT"].contains(rawCode)
    }
}

public struct CapturedTrack: Codable, Sendable {
    public let role: String
    public let file: String
    public let firstSampleUs: Int64?
    public let lastSampleEndUs: Int64?
    public let samples: Int
    public let droppedSamples: Int
    public let omittedSamples: Int
    public let heldTailUs: Int64
    public let sampleRate: Double?
    public let channelCount: UInt32?
}

public struct CaptureResult: Codable, Sendable {
    public init(
        state: String, source: CaptureSource, width: Int, height: Int, durationUs: Int64,
        hostOriginUs: Int64?, pauses: [PauseEvent], tracks: [CapturedTrack],
        failure: CaptureFailure?, systemAudioScope: String, cursor: CursorStats = CursorStats(),
        cleanupFailure: CaptureFailure? = nil
    ) {
        self.state = state
        self.source = source
        self.width = width
        self.height = height
        self.durationUs = durationUs
        self.hostOriginUs = hostOriginUs
        self.pauses = pauses
        self.tracks = tracks
        self.failure = failure
        self.cleanupFailure = cleanupFailure
        self.systemAudioScope = systemAudioScope
        self.cursor = cursor
    }

    public let state: String
    public let source: CaptureSource
    public let width: Int
    public let height: Int
    public let durationUs: Int64
    public let hostOriginUs: Int64?
    public let pauses: [PauseEvent]
    public let tracks: [CapturedTrack]
    public let failure: CaptureFailure?
    public let cleanupFailure: CaptureFailure?
    public let systemAudioScope: String
    public let cursor: CursorStats
}

// Companion measurement media can fail a take without changing its production track schema.
extension CaptureResult {
    package func withFailure(_ other: CaptureFailure?) -> CaptureResult {
        guard failure == nil, let reason = other else { return self }
        return CaptureResult(state: "interrupted", source: source, width: width, height: height,
            durationUs: durationUs, hostOriginUs: hostOriginUs, pauses: pauses, tracks: tracks,
            failure: reason, systemAudioScope: systemAudioScope, cursor: cursor, cleanupFailure: cleanupFailure)
    }
}
