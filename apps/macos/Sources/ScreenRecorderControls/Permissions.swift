import Foundation

extension ControlsState {
    /// What this app may capture, as native capture reads it. Reading it asks for nothing.
    public struct Permissions: Equatable, Sendable {
        public init(screen: Access, microphone: Access) {
            self.screen = screen
            self.microphone = microphone
        }
        public let screen: Access
        public let microphone: Access

        public func access(to kind: PermissionKind) -> Access {
            switch kind {
            case .screen: screen
            case .microphone: microphone
            }
        }
    }

    public enum Access: Equatable, Sendable {
        case granted
        /// Nobody has answered yet, so asking shows the system's own prompt.
        case undetermined
        /// Asking again prompts for nothing; only System Settings can change it.
        case denied

        /// AVFoundation's microphone authorization, as native capture names it.
        public init(microphoneAuthorization: String) {
            switch microphoneAuthorization {
            case "authorized": self = .granted
            case "not_determined": self = .undetermined
            default: self = .denied
            }
        }
    }
}

extension PermissionKind {
    /// The access a refused capture start was missing, when that is what refused it. Pressing
    /// Start says a person wants to record, so the app may ask macOS for it then.
    public static func missing(fromStartFailure code: String) -> PermissionKind? {
        switch code {
        case "MICROPHONE_PERMISSION_REQUIRED": .microphone
        case "PERMISSION_REQUIRED": .screen
        default: nil
        }
    }
}

/// One access a person grants this app. The menu and the Settings window describe each the same
/// way, from the same state, so the two surfaces can never disagree about what is missing.
public enum PermissionKind: CaseIterable, Sendable {
    case screen
    case microphone

    public var name: String {
        switch self {
        case .screen: "Screen Recording"
        case .microphone: "Microphone"
        }
    }

    /// Why a person would grant it.
    public var purpose: String {
        switch self {
        case .screen: "Needed to record your screen."
        case .microphone: "Needed to record narration."
        }
    }

    public var action: ControlsAction {
        switch self {
        case .screen: .requestScreenPermission
        case .microphone: .requestMicrophonePermission
        }
    }

    /// The disabled line a menu shows while access is missing.
    public var missingLine: String {
        switch self {
        case .screen: "Screen recording access is not granted."
        case .microphone: "Microphone access is not granted."
        }
    }

    /// The privacy pane that changes this access once a person has answered the prompt.
    public var settingsURL: URL {
        switch self {
        case .screen:
            URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")!
        case .microphone:
            URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!
        }
    }

    /// What the grant button says. A prompt that was already answered cannot be shown again, so
    /// the button says where the change happens instead of promising a prompt.
    public func allowTitle(for access: ControlsState.Access) -> String {
        switch access {
        case .denied: "Allow in System Settings…"
        case .undetermined, .granted:
            switch self {
            case .screen: "Allow Screen Recording…"
            case .microphone: "Allow Microphone Access…"
            }
        }
    }

    public func statusTitle(for access: ControlsState.Access) -> String {
        switch access {
        case .granted: "Allowed"
        case .undetermined: "Not allowed yet"
        case .denied: "Not allowed"
        }
    }
}
