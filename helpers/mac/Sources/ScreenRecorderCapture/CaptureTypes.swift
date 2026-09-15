import Foundation

public struct CaptureRegion: Codable, Sendable {
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
    public var source: CaptureSource
    public let outputDirectory: String
    public let microphone: Bool
    public let microphoneDeviceID: String?
    public let systemAudio: Bool
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
    public let state: String
    public let source: CaptureSource
    public let width: Int
    public let height: Int
    public let durationUs: Int64
    public let hostOriginUs: Int64?
    public let pauses: [PauseEvent]
    public let tracks: [CapturedTrack]
    public let failure: CaptureFailure?
    public let systemAudioScope: String
}
