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
        var removed: Int64 = 0
        for interval in intervals {
            if hostUs < interval.end && endUs > interval.start { return nil }
            if hostUs >= interval.start && hostUs < interval.end { return nil }
            if interval.end <= hostUs {
                removed += max(0, interval.end - max(originUs, interval.start))
            }
        }
        return hostUs - originUs - removed
    }
}
