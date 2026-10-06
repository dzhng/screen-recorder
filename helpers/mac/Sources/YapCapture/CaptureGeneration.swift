import Foundation

public struct CaptureGeneration: Sendable {
    public private(set) var current: UUID?

    public init() {}
    public mutating func begin() -> UUID {
        let generation = UUID()
        current = generation
        return generation
    }
    public mutating func end(_ generation: UUID) {
        if current == generation { current = nil }
    }
    public func accepts(_ generation: UUID) -> Bool {
        current == generation
    }
}
