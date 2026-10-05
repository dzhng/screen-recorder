import Foundation

/// Joins existing native intent to the service's atomic permit. Sparkle owns the
/// update cycle and launch exclusion; this owner never closes resources to obtain idle.
@MainActor
final class UpdateCoordinator {
    struct Status: Equatable {
        var state = "unavailable"
        var availableVersion: String?
        var blockers: [String] = []
        var error: Failure?
        struct Failure: Equatable {
            let code: String
            let message: String
            let retryable: Bool
        }
        var parameters: [String: Any] {
            [
                "update": [
                    "state": state, "availableVersion": availableVersion as Any? ?? NSNull(),
                    "blockers": blockers,
                    "error": error.map {
                        ["code": $0.code, "message": $0.message, "retryable": $0.retryable] as [String: Any]
                    } as Any? ?? NSNull(),
                ]
            ]
        }
    }
    private enum Phase { case waiting, preparing, committed, closing, authorized, cancelling, failed }
    private weak var host: ServiceHost?
    private let nativeBlockers: () -> [String]
    private let fence: (Bool) -> Void
    private let changed: () -> Void
    private var phase = Phase.waiting
    private var generation = UUID()
    private var permit: String?
    private var install: (() -> Void)?
    private var cancel: (() -> Void)?
    private var attempt: Task<Void, Never>?
    private var pendingProgress = false
    private var installerRequested = false
    private var releaseUnconfirmed = false
    private var manualCheck = false
    private var reported: Status?
    private(set) var status = Status()
    private(set) var available = false
    private(set) var enabled = false
    private(set) var cleanServiceExit = false
    private(set) var checkMessage: String?
    var preferenceChanged: ((Bool) -> Void)?

    var mayUpdate: Bool { enabled || manualCheck }
    var canStartManualCheck: Bool {
        available && !releaseUnconfirmed && !cleanServiceExit && phase == .waiting
            && install == nil && attempt == nil
            && ["idle", "disabled", "failed"].contains(status.state)
    }
    var checkFailure: ServiceFailure {
        if releaseUnconfirmed || cleanServiceExit {
            return ServiceFailure(code: "UPDATE_RESTART_REQUIRED", message: "Quit and reopen the app before checking for updates.")
        }
        return ServiceFailure(code: "UPDATE_BUSY", message: "An update is already in progress.", retryable: true)
    }
    func beginManualCheck() throws(ServiceFailure) {
        guard canStartManualCheck else { throw checkFailure }
        manualCheck = true
        checking()
    }

    init(
        blockers: @escaping () -> [String], fence: @escaping (Bool) -> Void,
        changed: @escaping () -> Void
    ) {
        nativeBlockers = blockers
        self.fence = fence
        self.changed = changed
    }
    func attach(to host: ServiceHost) {
        self.host = host
        reported = nil
        publish()
        progress()
    }
    func setAvailability(_ available: Bool, enabled: Bool) {
        self.available = available
        self.enabled = available && enabled
        status.state = available ? (self.enabled ? "idle" : "disabled") : "unavailable"
        publish()
    }
    func setEnabled(_ value: Bool) {
        guard available else { return }
        enabled = value
        preferenceChanged?(value)
        // Final authorization is the irreversible SDK boundary. A preference changed
        // here applies to the relaunched app, without retracting the granted replacement.
        if phase == .authorized {
            publish()
            return
        }
        if releaseUnconfirmed || cleanServiceExit {
            publish()
            return
        }
        if !value {
            manualCheck = false
            stop(state: "disabled")
        } else if manualCheck {
            publish()
        } else {
            status.state = "idle"
            publish()
            progress()
        }
    }
    func checking() {
        guard mayUpdate, !releaseUnconfirmed, !cleanServiceExit else { return }
        checkMessage = nil
        status.error = nil
        status.availableVersion = nil
        status.state = "checking"
        publish()
    }
    func candidate(version: String) {
        status.availableVersion = version
        if releaseUnconfirmed || cleanServiceExit {
            publish()
            return
        }
        status.error = nil
        status.state = mayUpdate ? "downloading" : "disabled"
        publish()
    }
    func ready(install: @escaping () -> Void, cancel: @escaping () -> Void) {
        self.install = install
        self.cancel = cancel
        if releaseUnconfirmed || cleanServiceExit {
            cancel()
            return
        }
        if !mayUpdate {
            stop(state: "disabled")
            return
        }
        phase = .waiting
        status.state = "waiting"
        progress()
    }
    /// Owner notifications, not a retry timer, provide another installation opportunity.
    func progress() {
        guard mayUpdate, !releaseUnconfirmed, !cleanServiceExit, install != nil else { return }
        if phase == .preparing || (phase == .waiting && attempt != nil) {
            pendingProgress = true
            return
        }
        guard phase == .waiting else { return }
        status.blockers = nativeBlockers()
        status.state = "waiting"
        publish()
        guard status.blockers.isEmpty, let host else { return }
        phase = .preparing
        fence(true)
        let current = generation
        attempt = Task { @MainActor in
            defer {
                attempt = nil
                if pendingProgress {
                    pendingProgress = false
                    progress()
                }
            }
            var granted: String?
            do {
                let data = try await host.call("update.prepare")
                let answer = try JSONDecoder().decode(Preparation.self, from: data)
                if answer.kind == "blocked" {
                    guard generation == current else { return }
                    phase = .waiting
                    fence(false)
                    status.blockers = answer.blockers ?? []
                    publish()
                    return
                }
                guard answer.kind == "prepared", let id = answer.permitId else {
                    throw ServiceFailure(code: "INVALID_RESPONSE", message: "Unreadable update permit")
                }
                granted = id
                guard generation == current, mayUpdate, nativeBlockers().isEmpty else {
                    guard await release(id, from: host) else { return }
                    if generation == current {
                        phase = .waiting
                        fence(false)
                        progress()
                    }
                    return
                }
                permit = id
                _ = try await host.call("update.commit", ["permitId": id])
                guard generation == current, mayUpdate, nativeBlockers().isEmpty else {
                    guard await release(id, from: host) else { return }
                    if generation == current {
                        permit = nil
                        phase = .waiting
                        fence(false)
                        progress()
                    }
                    return
                }
                phase = .committed
                status.blockers = ["launcher"]
                publish()
                installerRequested = true
                install?()
            } catch {
                if let granted, !(await release(granted, from: host)) { return }
                guard granted != nil else {
                    releaseUnconfirmed = true
                    phase = .failed
                    fail(
                        code: "UPDATE_RESTART_REQUIRED",
                        message: "Cannot confirm update preparation. Quit and reopen the app.")
                    return
                }
                guard generation == current else { return }
                permit = nil
                phase = .failed
                fence(false)
                fail(code: "UPDATE_PREPARATION_FAILED", message: error.localizedDescription)
                cancel?()
            }
        }
    }
    /// Only the patched SDK's installing callback carries exclusion authority.
    /// Its retained retry callback grants final replacement after actual clean EOF.
    func installing(authorize: @escaping () -> Void) {
        guard phase == .committed else { return }
        guard mayUpdate, permit != nil,
            nativeBlockers().isEmpty, let host
        else {
            stop(state: "failed")
            return
        }
        phase = .closing
        status.state = "installing"
        status.blockers = []
        publish()
        let current = generation
        Task { @MainActor in
            do {
                try await host.shutdownForUpdate()
                cleanServiceExit = true
                guard generation == current, mayUpdate, phase == .closing else { return }
                phase = .authorized
                authorize()
            } catch {
                guard generation == current else { return }
                stop(state: "failed")
                fail(code: "UPDATE_SHUTDOWN_FAILED", message: error.localizedDescription)
            }
        }
    }
    var mayTerminateForUpdate: Bool { phase == .authorized && cleanServiceExit }
    func ordinaryQuit() { stop(state: enabled ? "idle" : "disabled") }
    func cycleFinished(error: Error?, upToDate: Bool = false) {
        manualCheck = false
        let wasClosing = phase == .closing || phase == .authorized || cleanServiceExit
        generation = UUID()
        install = nil
        cancel = nil
        let oldPermit = permit
        permit = nil
        if wasClosing {
            phase = .failed
            fail(
                code: "UPDATE_RESTART_REQUIRED",
                message: "Update installation stopped. Quit and reopen the app to restore service.")
            return
        }
        phase = .cancelling
        let current = generation
        let activeAttempt = attempt
        Task { @MainActor in
            await activeAttempt?.value
            guard !releaseUnconfirmed else { return }
            if let oldPermit, let host {
                guard await release(oldPermit, from: host) else { return }
            }
            guard generation == current else { return }
            installerRequested = false
            phase = .waiting
            fence(false)
            status.blockers = []
            if let error {
                fail(code: "UPDATE_FAILED", message: error.localizedDescription)
            } else {
                checkMessage = upToDate ? "You’re up to date." : nil
                status.state = status.error == nil ? (enabled ? "idle" : "disabled") : "failed"
                publish()
            }
        }
    }
    func fail(code: String, message: String) {
        status.state = "failed"
        status.error = .init(code: code, message: message, retryable: false)
        publish()
    }
    private func stop(state: String) {
        generation = UUID()
        let old = phase
        phase = .cancelling
        status.state = state
        cancel?()
        // Before Sparkle receives Install there is no installer exclusion to drain.
        if old == .waiting || old == .failed, !installerRequested, !releaseUnconfirmed,
            !cleanServiceExit, permit == nil, attempt == nil
        {
            if install == nil { phase = .waiting }
            fence(false)
        }
        publish()
    }
    private func publish() {
        changed()
        guard status != reported, let host else { return }
        reported = status
        let parameters = status.parameters
        Task { @MainActor in _ = try? await host.call("update.report", parameters) }
    }
    private func release(_ id: String, from host: ServiceHost) async -> Bool {
        do {
            _ = try await host.call("update.release", ["permitId": id])
            return true
        } catch {
            releaseUnconfirmed = true
            phase = .failed
            fail(
                code: "UPDATE_RESTART_REQUIRED",
                message: "Cannot confirm update cancellation. Quit and reopen the app.")
            return false
        }
    }
    private struct Preparation: Decodable {
        let kind: String
        let permitId: String?
        let blockers: [String]?
    }
}
