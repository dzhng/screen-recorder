import Foundation

/**
 The floating controls a take carries while it runs.

 They are a second view of the same state the menu shows, so what they read is decided here rather
 than by a window watching the device for itself: a take that is recording or paused has controls
 on screen, and anything else — nothing live, a take being finalized, a service that can no longer
 answer — has none.
 */
public enum RecordingOverlay {
    /// What the floating controls say, or nil whenever they must not be on screen at all.
    public struct Presentation: Equatable, Sendable {
        public init(elapsed: String, paused: Bool) {
            self.elapsed = elapsed
            self.paused = paused
        }
        /// The take's own playback time, written the way the menu writes it.
        public let elapsed: String
        public let paused: Bool
    }

    public static func presentation(for state: ControlsState) -> Presentation? {
        guard let device = state.device, device.state == .recording || device.state == .paused
        else { return nil }
        return Presentation(
            elapsed: ElapsedTime.format(device.elapsedUs), paused: device.state == .paused)
    }
}
