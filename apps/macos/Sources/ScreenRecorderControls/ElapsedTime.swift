import Foundation

/// How playback time reads in the controls. The number itself always comes from the capture
/// clock; this only decides how it is written down.
public enum ElapsedTime {
    /// Elapsed playback time as a person reads a recorder: minutes and seconds, growing an hours
    /// field only once there is one. A take with no measured time yet reads as none, never as zero.
    public static func format(_ microseconds: Int64?) -> String {
        guard let microseconds, microseconds >= 0 else { return "—" }
        let seconds = microseconds / 1_000_000
        let minutes = seconds / 60
        if minutes < 60 {
            return String(format: "%d:%02d", minutes, seconds % 60)
        }
        return String(format: "%d:%02d:%02d", minutes / 60, minutes % 60, seconds % 60)
    }

    /// When a stored take was created, in this host's own locale, for a menu of recent takes.
    public static func shortTime(of iso8601: String) -> String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions.insert(.withFractionalSeconds)
        guard let date = fractional.date(from: iso8601) ?? ISO8601DateFormatter().date(from: iso8601)
        else { return iso8601 }
        let format = DateFormatter()
        format.dateStyle = .short
        format.timeStyle = .short
        return format.string(from: date)
    }
}
