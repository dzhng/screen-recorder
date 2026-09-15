import Darwin
import Foundation

/// Runtime facts the service reports about itself. It owns no capture state, so this
/// slice's health answer describes process lifetime only.
struct ServiceHealth: Decodable, Sendable {
    let status: String
    let pid: Int
    let socketPath: String
    let home: String
    let node: String
    let uptimeMs: Int
}

/// Owns the one Node service child this app launches, and the inherited JSON-lines
/// control channel to it. The child owns the private socket listener; this type owns
/// only its lifetime. There is no installed daemon and no automatic restart: a child
/// that fails or dies leaves a reported, actionable failure.
final class ServiceHost: @unchecked Sendable {
    enum State: Sendable {
        case starting
        case ready(pid: Int32, socketPath: String)
        case unavailable(code: String, message: String)
    }

    /// Bounded quit budget: EOF first, then signals against this child's own PID only.
    static let eofDeadline: TimeInterval = 4
    static let signalDeadline: TimeInterval = 2

    private let bundle: ServiceBundle
    private let queue = DispatchQueue(label: "com.david.screenrec.service-host")
    private let child = Process()
    private let input = Pipe()
    private let output = Pipe()
    private var state: State = .starting
    private var buffer = Data()
    private var discarding = false
    private var pending: [String: @Sendable (Result<Data, ServiceFailure>) -> Void] = [:]
    private var nextCall = 0
    private var stopping = false
    private var finished = false

    private let onState: @Sendable (State) -> Void

    init(bundle: ServiceBundle, onState: @escaping @Sendable (State) -> Void) {
        self.bundle = bundle
        self.onState = onState
    }

    func start() {
        publish(state)
        child.executableURL = URL(fileURLWithPath: bundle.node)
        child.arguments = [bundle.script.path]
        child.standardInput = input
        child.standardOutput = output
        // Diagnostics stay on the app's stderr; stdout carries control messages only.
        child.standardError = FileHandle.standardError
        // Never inherit a developer shell's working directory: the packaged service
        // must resolve nothing relative to a repository checkout.
        child.currentDirectoryURL = URL(fileURLWithPath: "/")
        child.terminationHandler = { [weak self] process in
            let status = process.terminationStatus
            guard let self else { return }
            queue.async { self.childExited(status: status) }
        }
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard let self else { return }
            queue.async { data.isEmpty ? self.channelClosed() : self.consume(data) }
        }
        do {
            try child.run()
        } catch {
            queue.async {
                self.fail(
                    code: "SERVICE_UNAVAILABLE",
                    message: "Could not launch \(self.bundle.node): \(error.localizedDescription)")
            }
            return
        }
        // The startup budget is the shared call budget: a child that has not announced
        // its listener within it is a startup failure, not something to keep waiting on.
        queue.asyncAfter(deadline: .now() + bundle.callTimeout) { [weak self] in
            guard let self, case .starting = state else { return }
            fail(
                code: "SERVICE_TIMEOUT",
                message: "Service did not report a listener within \(Int(bundle.callTimeout))s")
        }
    }

    func health(_ completion: @escaping @Sendable (Result<ServiceHealth, ServiceFailure>) -> Void) {
        call(operation: "service.health") { result in
            completion(
                result.flatMap { data in
                    guard let health = try? JSONDecoder().decode(ServiceHealth.self, from: data) else {
                        return .failure(
                            ServiceFailure(
                                code: "INVALID_RESPONSE", message: "Service returned unreadable health data"))
                    }
                    return .success(health)
                })
        }
    }

    private func call(
        operation: String, _ completion: @escaping @Sendable (Result<Data, ServiceFailure>) -> Void
    ) {
        queue.async {
            guard case .ready = self.state else {
                completion(.failure(self.unavailableFailure()))
                return
            }
            guard self.pending.count < self.bundle.maxPendingCalls else {
                completion(
                    .failure(
                        ServiceFailure(
                            code: "LIMIT_EXCEEDED",
                            message: "Too many service requests are already in flight.")))
                return
            }
            self.nextCall += 1
            let id = "app-\(self.nextCall)"
            let request: [String: Any] = ["id": id, "operation": operation, "params": [:]]
            guard let line = try? JSONSerialization.data(withJSONObject: request) else {
                completion(
                    .failure(ServiceFailure(code: "INVALID_REQUEST", message: "Could not encode \(operation)")))
                return
            }
            self.pending[id] = completion
            self.queue.asyncAfter(deadline: .now() + self.bundle.callTimeout) { [weak self] in
                guard let self, let waiting = pending.removeValue(forKey: id) else { return }
                waiting(.failure(ServiceFailure(code: "TIMEOUT", message: "\(operation) did not answer in time")))
            }
            // A child that died between the readiness check and this write must surface
            // as a settled failure, never as a signal that tears the app down.
            do { try self.input.fileHandleForWriting.write(contentsOf: line + Data([0x0a])) } catch {
                self.pending.removeValue(forKey: id)
                completion(.failure(ServiceFailure(code: "SERVICE_STOPPED", message: "Service control channel is closed")))
            }
        }
    }

    /// Normal quit: close the control pipe so the child closes its listener and unlinks
    /// its own socket, then escalate against this child's PID within a bounded deadline.
    func shutdown() {
        queue.sync {
            stopping = true
            try? input.fileHandleForWriting.close()
        }
        guard child.isRunning else { return }
        if waitForExit(Self.eofDeadline) { return }
        child.terminate()
        if waitForExit(Self.signalDeadline) { return }
        kill(child.processIdentifier, SIGKILL)
        _ = waitForExit(Self.signalDeadline)
    }

    private func waitForExit(_ deadline: TimeInterval) -> Bool {
        let limit = Date().addingTimeInterval(deadline)
        while child.isRunning && Date() < limit { Thread.sleep(forTimeInterval: 0.02) }
        return !child.isRunning
    }

    // MARK: control channel

    private func consume(_ data: Data) {
        var rest = data[...]
        while let terminator = rest.firstIndex(of: 0x0a) {
            let line = rest[rest.startIndex..<terminator]
            rest = rest[rest.index(after: terminator)...]
            if discarding {
                discarding = false
                buffer.removeAll()
                continue
            }
            if buffer.count + line.count + 1 > bundle.controlFrameBytes {
                buffer.removeAll()
                oversizedControlData()
                return
            }
            buffer.append(contentsOf: line)
            let complete = buffer
            buffer.removeAll()
            deliver(complete)
        }
        if discarding { return }
        if buffer.count + rest.count + 1 > bundle.controlFrameBytes {
            buffer.removeAll()
            discarding = true
            oversizedControlData()
            return
        }
        buffer.append(contentsOf: rest)
    }

    private func oversizedControlData() {
        fail(code: "CONTROL_LIMIT_EXCEEDED", message: "Service control message exceeds the byte limit")
    }

    private func deliver(_ line: Data) {
        guard let message = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any],
            let event = message["event"] as? String
        else {
            fail(code: "CONTROL_PROTOCOL", message: "Service sent an unreadable control message")
            return
        }
        switch event {
        case "started":
            guard let pid = (message["pid"] as? NSNumber)?.int32Value,
                let socketPath = message["socketPath"] as? String, !socketPath.isEmpty
            else {
                fail(code: "CONTROL_PROTOCOL", message: "Service announced an incomplete listener")
                return
            }
            guard case .starting = state else { return }
            state = .ready(pid: pid, socketPath: socketPath)
            publish(state)
        case "failed":
            let error = message["error"] as? [String: Any]
            fail(
                code: error?["code"] as? String ?? "SERVICE_UNAVAILABLE",
                message: error?["message"] as? String ?? "Service reported a startup failure")
        case "result":
            guard let response = message["response"] as? [String: Any] else {
                fail(code: "CONTROL_PROTOCOL", message: "Service sent a result without a response")
                return
            }
            guard let id = response["id"] as? String, let waiting = pending.removeValue(forKey: id) else {
                // An uncorrelated failure carries a null ID; it settles no specific call.
                return
            }
            if response["ok"] as? Bool == true {
                let payload = response["data"] ?? NSNull()
                guard
                    let data = try? JSONSerialization.data(
                        withJSONObject: payload, options: [.fragmentsAllowed])
                else {
                    waiting(
                        .failure(
                            ServiceFailure(code: "INVALID_RESPONSE", message: "Service returned unreadable data")))
                    return
                }
                waiting(.success(data))
            } else {
                let error = response["error"] as? [String: Any]
                waiting(
                    .failure(
                        ServiceFailure(
                            code: error?["code"] as? String ?? "INTERNAL_ERROR",
                            message: error?["message"] as? String ?? "Service operation failed")))
            }
        default:
            fail(code: "CONTROL_PROTOCOL", message: "Unknown service control event: \(event)")
        }
    }

    private func channelClosed() {
        output.fileHandleForReading.readabilityHandler = nil
        guard !stopping else { return }
        fail(code: "SERVICE_STOPPED", message: "Service closed its control channel")
    }

    private func childExited(status: Int32) {
        guard !stopping else { return }
        fail(code: "SERVICE_STOPPED", message: "Service exited with status \(status)")
    }

    /// One terminal failure per child. Settling every pending call here is what keeps a
    /// dead or unreadable channel from leaving callers waiting forever.
    private func fail(code: String, message: String) {
        let settled = pending
        pending.removeAll()
        if !finished {
            finished = true
            state = .unavailable(code: code, message: message)
            if child.isRunning {
                try? input.fileHandleForWriting.close()
                kill(child.processIdentifier, SIGTERM)
            }
            publish(state)
        }
        for waiting in settled.values { waiting(.failure(ServiceFailure(code: code, message: message))) }
    }

    private func publish(_ value: State) {
        let notify = onState
        DispatchQueue.main.async { notify(value) }
    }

    private func unavailableFailure() -> ServiceFailure {
        if case .unavailable(let code, let message) = state {
            return ServiceFailure(code: code, message: message)
        }
        return ServiceFailure(code: "SERVICE_STARTING", message: "Service has not reported a listener yet")
    }
}
