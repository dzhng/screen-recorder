/// Concurrent requests to end one capture share the operation that already owns its shutdown.
/// Cleanup belongs inside that operation: a joining caller may resume after a new take starts.
@MainActor
public final class CaptureTermination<Output: Sendable> {
    public init() {}
    private var active: Task<Output, Error>?
    public var isRunning: Bool { active != nil }

    public func run(_ operation: @escaping @MainActor () async throws -> Output) async throws -> Output {
        if let active { return try await active.value }
        let task = Task { @MainActor in
            defer { self.active = nil }
            return try await operation()
        }
        active = task
        return try await task.value
    }
}
