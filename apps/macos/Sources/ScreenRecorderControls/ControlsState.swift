import Foundation

/**
 Everything the recording controls know, in one value. It holds no device, no catalog and no clock:
 every field here was answered by the capture service, and the only thing this app decides for
 itself is what the person has selected to record next.
 */
public struct ControlsState: Equatable, Sendable {
    public init() {}

    public var service: ServiceState = .starting
    /// What the capture device reports about itself, once a status answer has arrived.
    public var device: DeviceStatus?
    /// The take the device is working on, as the library holds it.
    public var take: TakeStatus?
    public var sources = SourceCatalog()
    public var selection = CaptureSelection()
    public var recent: [RecentTake] = []
    /// The last failure a person's own action produced, kept visible until the next action.
    public var failure: String?
    /// Shortcuts whose key combination this app could not claim, so nothing was stolen.
    public var unavailableShortcuts: [String] = []
    /// Where a person can state their own key combinations when a default is taken.
    public var shortcutOverridePath: String?

    public enum ServiceState: Equatable, Sendable {
        case starting
        case ready
        case unavailable(String)
    }

    public enum DeviceState: String, Equatable, Sendable {
        case idle, selecting, recording, paused, finalizing
    }

    public struct Permissions: Equatable, Sendable {
        public init(screen: Bool, microphone: String) {
            self.screen = screen
            self.microphone = microphone
        }
        public let screen: Bool
        public let microphone: String
        public var microphoneAuthorized: Bool { microphone == "authorized" }
    }

    public struct DeviceStatus: Equatable, Sendable {
        public init(
            state: DeviceState, recordingId: String?, elapsedUs: Int64?, permissions: Permissions
        ) {
            self.state = state
            self.recordingId = recordingId
            self.elapsedUs = elapsedUs
            self.permissions = permissions
        }
        public let state: DeviceState
        public let recordingId: String?
        /// The running take's playback time, as its own capture clock measures it.
        public let elapsedUs: Int64?
        public let permissions: Permissions
    }

    public struct TakeStatus: Equatable, Sendable {
        public init(
            recordingId: String, state: String, interruptionReason: String?, sourceDurationUs: Int64?
        ) {
            self.recordingId = recordingId
            self.state = state
            self.interruptionReason = interruptionReason
            self.sourceDurationUs = sourceDurationUs
        }
        public let recordingId: String
        public let state: String
        public let interruptionReason: String?
        public let sourceDurationUs: Int64?
    }

    public struct Display: Equatable, Sendable {
        public init(id: Int, name: String, width: Int, height: Int) {
            self.id = id
            self.name = name
            self.width = width
            self.height = height
        }
        public let id: Int
        public let name: String
        public let width: Int
        public let height: Int
    }

    public struct Window: Equatable, Sendable {
        public init(id: Int, title: String, application: String) {
            self.id = id
            self.title = title
            self.application = application
        }
        public let id: Int
        public let title: String
        public let application: String
    }

    public struct Microphone: Equatable, Sendable {
        public init(id: String, name: String, isDefault: Bool) {
            self.id = id
            self.name = name
            self.isDefault = isDefault
        }
        public let id: String
        public let name: String
        public let isDefault: Bool
    }

    public struct SourceCatalog: Equatable, Sendable {
        public init(
            displays: [Display] = [], windows: [Window] = [], microphones: [Microphone] = []
        ) {
            self.displays = displays
            self.windows = windows
            self.microphones = microphones
        }
        public var displays: [Display]
        public var windows: [Window]
        public var microphones: [Microphone]
    }

    /// A rectangle of one display, in that display's own points with a top-left origin: the same
    /// coordinates a capture start carries, so nothing converts them a second time.
    public struct Region: Equatable, Sendable {
        public init(displayId: Int, displayName: String, x: Double, y: Double, width: Double, height: Double) {
            self.displayId = displayId
            self.displayName = displayName
            self.x = x
            self.y = y
            self.width = width
            self.height = height
        }
        public let displayId: Int
        public let displayName: String
        public let x: Double
        public let y: Double
        public let width: Double
        public let height: Double
    }

    public enum SelectedSource: Equatable, Sendable {
        case display(Display)
        case window(Window)
        case region(Region)
    }

    /// These takes are narrated, so a fresh launch has the microphone on and the machine's own
    /// sound off. `.systemDefault` follows whatever the person's default input is at start time.
    public enum MicrophoneChoice: Equatable, Sendable {
        case off
        case systemDefault
        case device(id: String, name: String)
    }

    public struct CaptureSelection: Equatable, Sendable {
        public init() {}
        public var source: SelectedSource?
        public var microphone: MicrophoneChoice = .systemDefault
        public var systemAudio = false
    }

    public struct RecentTake: Equatable, Sendable {
        public init(
            recordingId: String, createdAt: String, state: String, sourceDurationUs: Int64?,
            interruptionReason: String?
        ) {
            self.recordingId = recordingId
            self.createdAt = createdAt
            self.state = state
            self.sourceDurationUs = sourceDurationUs
            self.interruptionReason = interruptionReason
        }
        public let recordingId: String
        public let createdAt: String
        public let state: String
        public let sourceDurationUs: Int64?
        public let interruptionReason: String?
    }

    /// Whether a take is on the device right now. Only a live take can be stopped, paused,
    /// canceled or restarted.
    public var isLive: Bool {
        guard let device else { return false }
        return device.state == .recording || device.state == .paused || device.state == .selecting
    }
}

extension ControlsState.CaptureSelection {
    /// What a start asks the service for. The protocol owns both audio defaults, so this always
    /// states both explicitly, and the microphone is on unless a person turned it off.
    public struct Start: Equatable, Sendable, Decodable {
        public init(source: Source, microphone: Bool, microphoneDeviceId: String?, systemAudio: Bool) {
            self.source = source
            self.microphone = microphone
            self.microphoneDeviceId = microphoneDeviceId
            self.systemAudio = systemAudio
        }

        public let source: Source
        public let microphone: Bool
        public let microphoneDeviceId: String?
        public let systemAudio: Bool

        public enum Source: Equatable, Sendable, Decodable {
            case display(id: Int)
            case window(id: Int)
            case region(displayId: Int, x: Double, y: Double, width: Double, height: Double)

            private enum CodingKeys: String, CodingKey {
                case kind, displayId, windowId, x, y, width, height
            }

            public init(from decoder: Decoder) throws {
                let fields = try decoder.container(keyedBy: CodingKeys.self)
                switch try fields.decode(String.self, forKey: .kind) {
                case "display": self = .display(id: try fields.decode(Int.self, forKey: .displayId))
                case "window": self = .window(id: try fields.decode(Int.self, forKey: .windowId))
                case "region":
                    self = .region(
                        displayId: try fields.decode(Int.self, forKey: .displayId),
                        x: try fields.decode(Double.self, forKey: .x),
                        y: try fields.decode(Double.self, forKey: .y),
                        width: try fields.decode(Double.self, forKey: .width),
                        height: try fields.decode(Double.self, forKey: .height))
                default:
                    throw DecodingError.dataCorruptedError(
                        forKey: .kind, in: fields, debugDescription: "Unknown capture source")
                }
            }
        }
    }

    /// Nil until a person has chosen something to record: this app never guesses a source.
    public func start() -> Start? {
        guard let source else { return nil }
        let chosen: Start.Source =
            switch source {
            case .display(let display): .display(id: display.id)
            case .window(let window): .window(id: window.id)
            case .region(let region):
                .region(
                    displayId: region.displayId, x: region.x, y: region.y, width: region.width,
                    height: region.height)
            }
        switch microphone {
        case .off:
            return Start(
                source: chosen, microphone: false, microphoneDeviceId: nil, systemAudio: systemAudio)
        case .systemDefault:
            return Start(
                source: chosen, microphone: true, microphoneDeviceId: nil, systemAudio: systemAudio)
        case .device(let id, _):
            return Start(
                source: chosen, microphone: true, microphoneDeviceId: id, systemAudio: systemAudio)
        }
    }
}

extension ControlsState.CaptureSelection {
    /// A live take owns its selection, including when another client started it. Catalog labels
    /// are presentation only; absent labels must never replace the device's source identity.
    public mutating func apply(_ active: Start, catalog: ControlsState.SourceCatalog) {
        switch active.source {
        case .display(let id):
            source = .display(catalog.displays.first { $0.id == id }
                ?? .init(id: id, name: "Display \(id)", width: 0, height: 0))
        case .window(let id):
            source = .window(catalog.windows.first { $0.id == id }
                ?? .init(id: id, title: "Window \(id)", application: ""))
        case .region(let id, let x, let y, let width, let height):
            source = .region(.init(
                displayId: id, displayName: catalog.displays.first { $0.id == id }?.name ?? "Display \(id)",
                x: x, y: y, width: width, height: height))
        }
        if !active.microphone { microphone = .off }
        else if let id = active.microphoneDeviceId {
            microphone = .device(id: id, name: catalog.microphones.first { $0.id == id }?.name ?? id)
        } else { microphone = .systemDefault }
        systemAudio = active.systemAudio
    }
}

extension ControlsState {
    /// Refresh labels by identity. A browser navigation changes a title without closing its window.
    public mutating func reconcileSelection() -> String? {
        var failure: String?
        switch selection.source {
        case .display(let selected):
            selection.source = sources.displays.first { $0.id == selected.id }.map { .display($0) }
            if selection.source == nil { failure = "\(selected.name) is no longer available." }
        case .window(let selected):
            selection.source = sources.windows.first { $0.id == selected.id }.map { .window($0) }
            if selection.source == nil { failure = "That window has closed, so it is no longer selected." }
        case .region(let chosen) where !sources.displays.contains(where: { $0.id == chosen.displayId }):
            selection.source = nil
            failure = "\(chosen.displayName) is no longer available."
        case nil:
            selection.source = sources.displays.first.map { .display($0) }
        default: break
        }
        if case .device(let id, _) = selection.microphone,
            !sources.microphones.contains(where: { $0.id == id }) {
            selection.microphone = .systemDefault
        }
        return failure
    }
}
