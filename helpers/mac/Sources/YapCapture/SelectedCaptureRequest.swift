import Foundation

/// Feature-owned measurement request; deliberately absent from production capture protocol.
public struct SelectedCaptureRequest: Codable, Sendable {
    public let source: CaptureSource
    public let cameraID: String
    public let microphone: Microphone
    public let outputDirectory: String
    public let framesPerSecond: Int
    public let durationSeconds: Double
    public let cameraDelaySeconds: Double
    public let pause: Pause?

    public struct Microphone: Codable, Sendable {
        public let enabled: Bool
        public let deviceID: String?
    }
    public struct Pause: Codable, Sendable {
        public let atSeconds: Double
        public let durationSeconds: Double
    }

    public func validate() throws {
        func require(_ condition: Bool, _ message: String) throws {
            if !condition { throw CaptureFailure("INVALID_REQUEST", message) }
        }
        try require(!cameraID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            "Select an explicit camera uniqueID.")
        try require(microphone.enabled
            ? !(microphone.deviceID?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
            : microphone.deviceID == nil,
            "Microphone must have an explicit uniqueID when enabled, or no ID when disabled.")
        try require(outputDirectory.hasPrefix("/") && outputDirectory != "/",
            "Select an absolute evidence destination.")
        try require(framesPerSecond > 0 && framesPerSecond <= Int32.max, "Probe frame rate must fit a positive CMTime timescale.")
        try require(durationSeconds.isFinite && durationSeconds > 0 && durationSeconds <= 3600,
            "Probe duration must be positive and no more than one hour.")
        try require(cameraDelaySeconds.isFinite && cameraDelaySeconds >= 0
            && cameraDelaySeconds < durationSeconds, "Camera delay must fit inside the take.")
        if let pause {
            try require(pause.atSeconds.isFinite && pause.durationSeconds.isFinite
                && pause.atSeconds > cameraDelaySeconds && pause.durationSeconds > 0
                && pause.atSeconds + pause.durationSeconds < durationSeconds,
                "Pause must fit inside the take.")
        }
        switch source.kind {
        case "window":
            try require(source.windowID != nil && source.windowID != 0
                && source.displayID == nil && source.region == nil, "Select only a window ID.")
        case "display", "region":
            try require(source.displayID != nil && source.displayID != 0 && source.windowID == nil,
                "Select an explicit display ID.")
            if source.kind == "region", let r = source.region {
                try require([r.x,r.y,r.width,r.height].allSatisfy(\.isFinite)
                    && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0,
                    "Select a finite nonempty display-local region.")
            } else {
                try require(source.kind == "display" && source.region == nil,
                    "Region selection requires its rectangle.")
            }
        default: throw CaptureFailure("INVALID_REQUEST", "Select display, window or region.")
        }
    }

    package func requireAuthorization(screen: Bool, camera: Bool, microphone: Bool) throws {
        try validate()
        guard screen && camera && (!self.microphone.enabled || microphone) else {
            throw CaptureFailure("PERMISSION_REQUIRED",
                "Selected screen, camera and enabled microphone must already be authorized. No permission was requested.")
        }
    }

    package static func requireDevice(_ id: String, among identities: [String], role: String) throws {
        guard identities.contains(id) else {
            throw CaptureFailure("SOURCE_UNAVAILABLE", "Selected \(role) uniqueID is unavailable; no substitute was selected.")
        }
    }
}
