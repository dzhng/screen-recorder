import Foundation

@MainActor
package struct CaptureStreamOperation {
    let start: @MainActor () async throws -> Void
    let stop: @MainActor () async throws -> Void
    package init(start: @escaping @MainActor () async throws -> Void,
        stop: @escaping @MainActor () async throws -> Void) {
        self.start = start; self.stop = stop
    }
}

/// Owns SDK operations, not take state. Drain joins pending starts before stopping each
/// attempted resource once; a failed SDK start may already have partially acquired it.
@MainActor
package final class CaptureStreamInputs {
    package init() {}
    private var starting: Task<Void, Error>?
    private var stopping: Task<CaptureFailure?, Never>?
    private var attempted: [CaptureStreamOperation] = []

    package func start(_ operations: [CaptureStreamOperation],
        checkInterruption: @escaping @MainActor () throws -> Void) async throws {
        try Task.checkCancellation()
        guard stopping == nil else { throw CancellationError() }
        let task = starting ?? Task { @MainActor in
            for operation in operations {
                try Task.checkCancellation(); try checkInterruption()
                guard self.stopping == nil else { throw CancellationError() }
                self.attempted.append(operation)
                try await operation.start()
                try Task.checkCancellation(); try checkInterruption()
            }
        }
        starting = task
        try await withTaskCancellationHandler { try await task.value } onCancel: { task.cancel() }
    }

    package func stop() -> Task<CaptureFailure?, Never> {
        if let stopping { return stopping }
        let startup = starting
        let task = Task { @MainActor in
            if let startup { _ = try? await startup.value }
            let resources = self.attempted
            self.attempted = []
            var failure: CaptureFailure?
            for resource in resources {
                do { try await resource.stop() }
                catch { failure = failure ?? (error as? CaptureFailure)
                    ?? CaptureFailure("NATIVE_CAPTURE_FAILED", error.localizedDescription) }
            }
            return failure
        }
        stopping = task
        return task
    }
}
