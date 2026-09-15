import Foundation

public struct PauseEvent: Codable, Sendable, Equatable {
    public let atSourceUs: Int64
    public let elapsedPauseUs: Int64
}

public struct CaptureClock: Sendable {
    public private(set) var originUs: Int64?
    public private(set) var pauses: [PauseEvent] = []
    private var intervals: [(start: Int64, end: Int64)] = []
    private var pausedAt: Int64?

    public init() {}
    public var isPaused: Bool { pausedAt != nil }
    public mutating func start(at hostUs: Int64) { if originUs == nil { originUs = hostUs } }
    public mutating func pause(at hostUs: Int64) { if pausedAt == nil { pausedAt = hostUs } }
    public mutating func resume(at hostUs: Int64) {
        guard let start = pausedAt, hostUs >= start else { return }
        pausedAt = nil
        if let boundary = sourceTime(for: start) {
            pauses.append(PauseEvent(atSourceUs: boundary, elapsedPauseUs: hostUs - start))
        }
        intervals.append((start, hostUs))
    }
    public func sourceTime(for hostUs: Int64, durationUs: Int64 = 0) -> Int64? {
        guard let originUs, hostUs >= originUs else { return nil }
        let endUs = hostUs + max(0, durationUs)
        if let pausedAt, hostUs >= pausedAt || endUs > pausedAt { return nil }
        for interval in intervals {
            if hostUs < interval.end && endUs > interval.start { return nil }
            if hostUs >= interval.start && hostUs < interval.end { return nil }
        }
        return hostUs - originUs - removedBefore(hostUs, originUs: originUs)
    }

    /// How much source time this take holds right now: the same playback coordinate its media is
    /// written in, with paused time already removed. It stops advancing while the take is paused,
    /// because paused wall time is not recording time. Whoever displays elapsed time reads this
    /// rather than deriving a second clock of its own.
    public func elapsedSourceUs(at hostUs: Int64) -> Int64? {
        guard let originUs else { return nil }
        let at = min(pausedAt ?? hostUs, hostUs)
        guard at > originUs else { return 0 }
        return at - originUs - removedBefore(at, originUs: originUs)
    }

    /// Paused time this take has already resumed from, before the given host instant.
    private func removedBefore(_ hostUs: Int64, originUs: Int64) -> Int64 {
        var removed: Int64 = 0
        for interval in intervals where interval.end <= hostUs {
            removed += max(0, interval.end - max(originUs, interval.start))
        }
        return removed
    }
}
