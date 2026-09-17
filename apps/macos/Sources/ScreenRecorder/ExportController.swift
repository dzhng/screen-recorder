import AppKit
import ScreenRecorderControls
import UniformTypeIdentifiers

/**
 The native export actions. Every export is one service export identity: this chooses its
 destination, pins the revision before the save panel opens, and reports what `export.status`
 answers. Retry, abandonment and cleanup stay with the service; after a restart, unfinished exports
 are rediscovered from `export.list` rather than from anything this app stored.
 */
@MainActor
final class ExportController {
    typealias Call = @MainActor (String, [String: Any]) async throws(ServiceFailure) -> Data
    /// Asks a person where to write an export. Nil means they chose not to export.
    typealias Choose = @MainActor (_ kind: ExportsState.Kind, _ suggestedName: String) async -> URL?

    private(set) var state = ExportsState()
    private let call: Call
    private let choose: Choose
    private let reveal: @MainActor (URL) -> Void
    private let changed: @MainActor () -> Void
    private let failure: @MainActor (String) -> Void
    private var observing = false
    private var discovering = false
    private var pendingDiscovery = false

    init(
        call: @escaping Call, choose: @escaping Choose = ExportController.savePanel,
        reveal: @escaping @MainActor (URL) -> Void = { NSWorkspace.shared.activateFileViewerSelecting([$0]) },
        changed: @escaping @MainActor () -> Void, failure: @escaping @MainActor (String) -> Void
    ) {
        self.call = call
        self.choose = choose
        self.reveal = reveal
        self.changed = changed
        self.failure = failure
    }

    // MARK: acting

    func export(_ recordingId: String, kind: ExportsState.Kind) {
        guard state.beginChoice(recordingId: recordingId, kind: kind) else { return }
        changed()
        Task { @MainActor in
            defer { changed() }
            // The revision is pinned before the panel opens, so an edit made while a person picks
            // a folder does not change what they asked to export.
            let answer: Data
            do throws(ServiceFailure) {
                answer = try await call("recording.get", ["recordingId": recordingId])
            } catch {
                state.choosing = nil
                return failure(error.localizedDescription)
            }
            guard let recording = try? JSONDecoder().decode(Recording.self, from: answer) else {
                state.choosing = nil
                return failure("The service returned an unreadable recording.")
            }
            guard let revisionId = recording.currentRevisionId else {
                state.choosing = nil
                return failure("This recording has no revision to export yet.")
            }
            guard let destination = await choose(kind, Self.suggestedName(recording, revisionId, kind))
            else {
                state.choosing = nil
                return
            }
            let request = ExportsState.Request(
                // The service accepts lowercase UUIDs only.
                exportId: UUID().uuidString.lowercased(), recordingId: recordingId, kind: kind,
                revisionId: revisionId, directory: destination.deletingLastPathComponent().path,
                leaf: destination.lastPathComponent)
            state.send(request)
            await send(request)
        }
    }

    func resend(_ exportId: String) {
        guard let request = state.resend(exportId) else { return }
        changed()
        Task { @MainActor in
            await send(request)
            changed()
        }
    }

    func retry(_ exportId: String) {
        guard state.begin(.retry, exportId) else { return }
        changed()
        Task { @MainActor in
            defer { changed() }
            do throws(ServiceFailure) {
                let answer = try await call("export.retry", ["exportId": exportId])
                if let record = try? JSONDecoder().decode(ExportsState.Record.self, from: answer) {
                    state.update(record)
                }
                state.finish(exportId, failure: nil)
            } catch where error.code == "NOT_FOUND" {
                state.forget(exportId)
            } catch {
                state.finish(exportId, failure: error.localizedDescription)
            }
        }
    }

    /// Abandonment drains the export and removes its private staging; a committed file remains.
    /// For an unconfirmed request it also settles whether that request was ever admitted.
    func abandon(_ exportId: String) {
        guard state.begin(.abandon, exportId) else { return }
        changed()
        Task { @MainActor in
            defer { changed() }
            do throws(ServiceFailure) {
                _ = try await call("export.abandon", ["exportId": exportId])
                state.forget(exportId)
            } catch {
                state.finish(exportId, failure: error.localizedDescription)
            }
        }
    }

    func reveal(_ exportId: String) {
        guard let output = state.records.first(where: { $0.exportId == exportId })?.output else { return }
        reveal(URL(fileURLWithPath: output))
    }

    func dismiss(_ exportId: String) {
        state.dismiss(exportId)
        changed()
    }

    func forgetRecording(_ recordingId: String) {
        state.forgetRecording(recordingId)
        changed()
    }

    // MARK: observing

    /// Reads the status of every export that can still change without a person acting here.
    /// One sweep at a time; the controls cadence calls this again.
    func tick() {
        let observed = state.observed
        guard !observing, !observed.isEmpty else { return }
        observing = true
        Task { @MainActor in
            defer { observing = false }
            var changedAny = false
            for exportId in observed {
                let unconfirmed = state.requests.contains { $0.exportId == exportId }
                do throws(ServiceFailure) {
                    let answer = try await call("export.status", ["exportId": exportId])
                    guard let record = try? JSONDecoder().decode(ExportsState.Record.self, from: answer)
                    else { continue }
                    if unconfirmed { state.admit(record) } else { state.update(record) }
                    changedAny = true
                } catch where error.code == "NOT_FOUND" {
                    // An unconfirmed request may simply not have been admitted; it stays until a
                    // person sends it again or abandons it. A described export is gone for good.
                    if !unconfirmed {
                        state.forget(exportId)
                        changedAny = true
                    }
                } catch {
                    // A transient read failure changes nothing a person can act on.
                }
            }
            if changedAny { changed() }
        }
    }

    /// Finds unfinished exports, including ones from before this app launched, and reads the
    /// status of each. Overlapping requests coalesce into one follow-up traversal.
    func discover() {
        guard !discovering else {
            pendingDiscovery = true
            return
        }
        discovering = true
        Task { @MainActor in
            defer {
                discovering = false
                changed()
                if pendingDiscovery {
                    pendingDiscovery = false
                    discover()
                }
            }
            var cursor: Any = NSNull()
            do throws(ServiceFailure) {
                repeat {
                    var params: [String: Any] = ["unfinishedOnly": true]
                    if !(cursor is NSNull) { params["cursor"] = cursor }
                    let data = try await call("export.list", params)
                    guard let page = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                        let summaries = page["exports"] as? [[String: Any]]
                    else {
                        throw ServiceFailure(code: "INVALID_RESPONSE", message: "export.list returned unreadable data")
                    }
                    for exportId in summaries.compactMap({ $0["exportId"] as? String }) {
                        do throws(ServiceFailure) {
                            let answer = try await call("export.status", ["exportId": exportId])
                            if let record = try? JSONDecoder().decode(ExportsState.Record.self, from: answer) {
                                if state.requests.contains(where: { $0.exportId == exportId }) {
                                    state.admit(record)
                                } else {
                                    state.update(record)
                                }
                            }
                        } catch where error.code == "NOT_FOUND" {
                            // Retired between the page and its status read.
                        }
                    }
                    cursor = page["nextCursor"] ?? NSNull()
                } while !(cursor is NSNull)
                state.discoveryFailure = nil
            } catch {
                state.discoveryFailure = error.localizedDescription
            }
        }
    }

    // MARK: sending

    private func send(_ request: ExportsState.Request) async {
        let params: [String: Any] = [
            "exportId": request.exportId, "recordingId": request.recordingId,
            "kind": request.kind.rawValue, "revisionId": request.revisionId,
            "directory": request.directory, "leaf": request.leaf,
        ]
        do throws(ServiceFailure) {
            let answer = try await call("export.create", params)
            guard let record = try? JSONDecoder().decode(ExportsState.Record.self, from: answer) else {
                return state.unanswered(request.exportId, reason: "The service returned an unreadable export.")
            }
            state.admit(record)
        } catch where Self.unanswered.contains(error.code) {
            state.unanswered(request.exportId, reason: error.localizedDescription)
        } catch {
            state.refuse(request.exportId)
            failure(error.localizedDescription)
        }
    }

    /// Failures that leave open whether the service admitted the request.
    private static let unanswered: Set = ["TIMEOUT", "SERVICE_STOPPED", "SERVICE_UNAVAILABLE"]

    // MARK: destination

    private static func suggestedName(_ recording: Recording, _ revisionId: String, _ kind: ExportsState.Kind)
        -> String
    {
        let when = ISO8601DateFormatter.fractional.date(from: recording.createdAt)
            ?? ISO8601DateFormatter().date(from: recording.createdAt) ?? Date()
        let stamp = DateFormatter()
        stamp.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss"
        let base = "Recording \(stamp.string(from: when)) \(revisionId)"
        return base + (kind == .video ? ".mp4" : ".zip")
    }

    static func savePanel(kind: ExportsState.Kind, suggestedName: String) async -> URL? {
        let panel = NSSavePanel()
        panel.title = kind == .video ? "Export Video" : "Export AI Package"
        panel.nameFieldStringValue = suggestedName
        panel.allowedContentTypes = [kind == .video ? .mpeg4Movie : .zip]
        panel.canCreateDirectories = true
        NSApp.activate(ignoringOtherApps: true)
        return await withCheckedContinuation { continuation in
            panel.begin { response in
                continuation.resume(returning: response == .OK ? panel.url : nil)
            }
        }
    }

    private struct Recording: Decodable {
        let createdAt: String
        let currentRevisionId: String?
    }
}

extension ISO8601DateFormatter {
    fileprivate static var fractional: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions.insert(.withFractionalSeconds)
        return formatter
    }
}
