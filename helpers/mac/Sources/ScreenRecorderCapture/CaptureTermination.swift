/// Concurrent requests to end one capture share the operation that already owns its shutdown.
/// Cleanup belongs inside that operation: a joining caller may resume after a new take starts.
@MainActor
public final class CaptureTermination<Output: Sendable> {
    public init() {}
    private var active: Task<Output, Error>?
    public var isRunning: Bool { active != nil }
    public var current: Task<Output, Error>? { active }

    /// Starts one owned operation or returns the one already running. Transport callers may
    /// stop waiting without canceling shared work; cancellation is an explicit owner action.
    public func start(_ operation: @escaping @MainActor () async throws -> Output) -> Task<Output, Error> {
        if let active { return active }
        let task = Task { @MainActor in
            defer { self.active = nil }
            return try await operation()
        }
        active = task
        return task
    }

    public func run(_ operation: @escaping @MainActor () async throws -> Output) async throws -> Output {
        try await start(operation).value
    }

    public func requestCancellation() { active?.cancel() }
}
