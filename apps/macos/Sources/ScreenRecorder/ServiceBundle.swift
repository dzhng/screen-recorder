import Foundation

struct ServiceFailure: Error {
    let code: String
    let message: String
}

/// What the build placed in `Contents/Resources/service`: the bundled entrypoint, the
/// interpreter the build validated against, and the shared control-channel limits.
/// Those limits are written from the protocol package so this app restates none of them.
struct ServiceBundle {
    let script: URL
    let node: String
    let controlFrameBytes: Int
    let maxPendingCalls: Int
    let callTimeout: TimeInterval
    /// When startup as a whole must have produced an answer. It is fixed before the
    /// interpreter is probed, so resolving an interpreter and the child reporting its
    /// listener share one budget instead of each getting a fresh one.
    let startupDeadline: Date

    private struct Manifest: Decodable {
        let nodePath: String
        let controlFrameBytes: Int
        let maxPendingCalls: Int
        let callTimeoutMs: Int
    }

    /// Probing interpreters runs child processes, so resolution answers on a background
    /// queue and the caller stays responsive while the startup deadline runs down.
    static func resolve(
        in bundle: Bundle = .main,
        environment: [String: String] = ProcessInfo.processInfo.environment,
        completion: @escaping @Sendable (Result<ServiceBundle, ServiceFailure>) -> Void
    ) {
        guard let script = bundle.url(forResource: "main", withExtension: "mjs", subdirectory: "service"),
            let manifestURL = bundle.url(forResource: "runtime", withExtension: "json", subdirectory: "service"),
            let data = try? Data(contentsOf: manifestURL),
            let manifest = try? JSONDecoder().decode(Manifest.self, from: data)
        else {
            completion(
                .failure(
                    ServiceFailure(
                        code: "SERVICE_MISSING",
                        message: "This build has no usable service in Contents/Resources/service")))
            return
        }
        let callTimeout = TimeInterval(manifest.callTimeoutMs) / 1000
        let deadline = Date().addingTimeInterval(callTimeout)
        DispatchQueue.global(qos: .userInitiated).async {
            completion(
                NodeRuntime.resolve(
                    recorded: manifest.nodePath, environment: environment, deadline: deadline
                ).map { node in
                    ServiceBundle(
                        script: script,
                        node: node,
                        controlFrameBytes: manifest.controlFrameBytes,
                        maxPendingCalls: manifest.maxPendingCalls,
                        callTimeout: callTimeout,
                        startupDeadline: deadline)
                })
        }
    }
}
