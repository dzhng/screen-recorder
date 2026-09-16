import Foundation

/// How the always-visible status-bar item reads. A person who is recording should be able to see
/// that from the menu bar alone, without opening anything, so the item carries the take's own
/// elapsed playback time beside a symbol for what the device is doing.
public enum StatusItemAppearance {
    public static func symbolName(for state: ControlsState) -> String {
        if case .unavailable = state.service { return "exclamationmark.triangle" }
        switch state.device?.state {
        case .recording: return "record.circle.fill"
        case .paused: return "pause.circle"
        case .finalizing, .selecting: return "circle.dotted"
        default: return "record.circle"
        }
    }

    /// The text beside the symbol: a live take's clock, and nothing at all when none is running.
    public static func title(for state: ControlsState) -> String {
        state.isLive ? ElapsedTime.format(state.device?.elapsedUs) : ""
    }
}
