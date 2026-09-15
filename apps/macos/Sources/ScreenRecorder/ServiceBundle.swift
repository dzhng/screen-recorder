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

    private struct Manifest: Decodable {
        let nodePath: String
        let controlFrameBytes: Int
        let maxPendingCalls: Int
        let callTimeoutMs: Int
    }

    static func resolve(
        in bundle: Bundle = .main, environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Result<ServiceBundle, ServiceFailure> {
        guard let script = bundle.url(forResource: "main", withExtension: "mjs", subdirectory: "service"),
            let manifestURL = bundle.url(forResource: "runtime", withExtension: "json", subdirectory: "service"),
            let data = try? Data(contentsOf: manifestURL),
            let manifest = try? JSONDecoder().decode(Manifest.self, from: data)
        else {
            return .failure(
                ServiceFailure(
                    code: "SERVICE_MISSING",
                    message: "This build has no usable service in Contents/Resources/service"))
        }
        return NodeRuntime.resolve(recorded: manifest.nodePath, environment: environment).map { node in
            ServiceBundle(
                script: script,
                node: node,
                controlFrameBytes: manifest.controlFrameBytes,
                maxPendingCalls: manifest.maxPendingCalls,
                callTimeout: TimeInterval(manifest.callTimeoutMs) / 1000)
        }
    }
}
