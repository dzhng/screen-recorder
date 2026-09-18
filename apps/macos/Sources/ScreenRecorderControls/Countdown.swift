import Foundation

/**
 The count a start shows before capture begins.

 It exists so a person knows when the recording starts, and so the take never contains the count
 itself: nothing is asked of the service until the last number has gone. The count is a number and
 the rule for spending it; when it runs out is the only thing it decides.
 */
public struct Countdown: Equatable, Sendable {
    /// What the preference asks for while it is on. Long enough to leave the menu and reach what
    /// is being recorded, short enough that nobody waits through it.
    public static let defaultSeconds = 3

    /// Nil when there is nothing to count: a count of zero or less starts capture immediately
    /// rather than showing a number nobody can read.
    public init?(seconds: Int) {
        guard seconds > 0 else { return nil }
        remaining = seconds
    }

    /// The number on screen right now.
    public private(set) var remaining: Int

    /// One second of the count spent. False once the count has run out, which is when capture is
    /// asked for.
    public mutating func tick() -> Bool {
        remaining -= 1
        return remaining > 0
    }
}
