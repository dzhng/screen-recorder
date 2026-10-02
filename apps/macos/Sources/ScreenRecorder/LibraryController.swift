import Foundation
import ScreenRecorderControls

/// The public library reads and explicit deletion requests shared by the native menu.
@MainActor
final class LibraryController {
    typealias Call = @MainActor (String, [String: Any]) async throws(ServiceFailure) -> Data
    private let call: Call
    private let changed: () -> Void
    private let closePreview: (MediaTarget) -> Void
    private let forgetExports: (MediaTarget) -> Void
    private let deleted: () -> Void
    private let preview: (String) -> Void
    private let export: (String, ExportsState.Kind) -> Void
    private(set) var state = LibraryState() { didSet { changed() } }
    private var ready = false
    private var serviceGeneration = UUID()
    private var recordingGeneration = UUID()
    private var projectGeneration = UUID()
    private var recordingsReading = false
    private var pendingRecordings = false
    private var jobsReading = false
    private var pendingProjects = false
    private var pages: [LibraryState.Cursor?] = [nil]
    private var pageIndex = 0

    init(call: @escaping Call, changed: @escaping () -> Void,
        closePreview: @escaping (MediaTarget) -> Void, forgetExports: @escaping (MediaTarget) -> Void,
        deleted: @escaping () -> Void,
        preview: @escaping (String) -> Void, export: @escaping (String, ExportsState.Kind) -> Void)
    {
        self.call = call; self.changed = changed; self.closePreview = closePreview
        self.forgetExports = forgetExports; self.deleted = deleted
        self.preview = preview; self.export = export
    }

    func serviceChanged(ready: Bool) {
        self.ready = ready
        serviceGeneration = UUID(); recordingGeneration = UUID(); projectGeneration = UUID()
        recordingsReading = false; jobsReading = false; pendingRecordings = false; pendingProjects = false
        state.projectsRefreshing = false
        state.progressFailure = nil
        // An unanswered deletion keeps its identity but must be explicitly retried on the new service.
        for target in state.deletions.keys where state.deletions[target]?.isPending == true {
            state.finishDelete(target, failure: "SERVICE_STOPPED: Delete was not confirmed.")
        }
        pages = [nil]; pageIndex = 0; state.hasPreviousPage = false
        if ready { refresh() }
    }

    func refresh() { refreshRecordings(); refreshProjects() }

    /// Delivery remains owned by the existing controllers; this boundary resolves library identity.
    func perform(_ action: ControlsAction) -> Bool {
        switch action {
        case .previewProject(let id): if usable(id) { preview(id) }
        case .exportProject(let id, let kind): if usable(id) { export(id, kind) }
        case .deleteRecording(let id): delete(.recording(id))
        case .deleteProject(let id): delete(.project(id))
        case .nextProjects: nextProjects()
        case .previousProjects: previousProjects()
        case .refreshLibrary: refresh()
        default: return false
        }
        return true
    }
    private func usable(_ projectId: String) -> Bool {
        ready && state.deletions[.project(projectId)] == nil && state.projects.contains { $0.projectId == projectId }
    }

    func refreshRecordings() {
        guard ready else { return }
        guard !recordingsReading else { pendingRecordings = true; return }
        recordingsReading = true
        recordingGeneration = UUID()
        let service = serviceGeneration, generation = recordingGeneration
        Task { @MainActor in
            defer {
                if service == serviceGeneration && generation == recordingGeneration {
                    recordingsReading = false
                    if pendingRecordings { pendingRecordings = false; refreshRecordings() }
                }
            }
            do throws(ServiceFailure) {
                let page: Recordings = try await read("recording.list", ["limit": 5])
                guard service == serviceGeneration && generation == recordingGeneration else { return }
                guard page.recordings.count <= 5,
                    Set(page.recordings.map(\.recordingId)).count == page.recordings.count else {
                    throw Self.invalid("Unreadable recording page")
                }
                for take in page.recordings { try validate(take) }
                state.recent = page.recordings.filter { state.deletions[.recording($0.recordingId)] == nil }
                state.recordingFailure = nil
                state.progressFailure = nil
            } catch {
                guard service == serviceGeneration && generation == recordingGeneration else { return }
                state.recordingFailure = error.localizedDescription
            }
        }
    }

    func refreshProjects() {
        guard !state.projectsRefreshing else { pendingProjects = true; return }
        readProjects(index: pageIndex)
    }
    func nextProjects() {
        guard !state.projectsRefreshing, let cursor = state.nextCursor else { return }
        pages = Array(pages.prefix(pageIndex + 1)) + [cursor]
        readProjects(index: pageIndex + 1)
    }
    func previousProjects() {
        guard pageIndex > 0 else { return }
        readProjects(index: pageIndex - 1)
    }
    private func readProjects(index: Int) {
        guard ready else { return }
        projectGeneration = UUID()
        let generation = projectGeneration, service = serviceGeneration, cursor = pages[index]
        state.projectsRefreshing = true
        Task { @MainActor in
            do throws(ServiceFailure) {
                var params: [String: Any] = ["limit": 5]
                if let cursor { params["cursor"] = ["afterSequence": cursor.afterSequence] }
                let page: Projects = try await read("project.list", params)
                guard service == serviceGeneration && generation == projectGeneration else { return }
                guard page.projects.count <= 5,
                    Set(page.projects.map(\.projectId)).count == page.projects.count,
                    page.nextCursor.map({ $0.afterSequence > (cursor?.afterSequence ?? 0) }) ?? true else {
                    throw Self.invalid("Unreadable project page or cursor")
                }
                state.projects = page.projects.filter { state.deletions[.project($0.projectId)] == nil }
                state.nextCursor = page.nextCursor
                pageIndex = index; state.hasPreviousPage = index > 0
                state.projectFailure = nil
            } catch {
                guard service == serviceGeneration && generation == projectGeneration else { return }
                state.projectFailure = error.localizedDescription
            }
            guard service == serviceGeneration && generation == projectGeneration else { return }
            state.projectsRefreshing = false
            if pendingProjects { pendingProjects = false; refreshProjects() }
        }
    }

    func delete(_ target: MediaTarget) {
        guard ready, state.beginDelete(target) else { return }
        // Catalog answers started before this action cannot restore the retired owner.
        recordingGeneration = UUID(); projectGeneration = UUID()
        recordingsReading = false; state.projectsRefreshing = false; pendingProjects = false
        closePreview(target)
        let service = serviceGeneration
        Task { @MainActor in
            do throws(ServiceFailure) {
                let operation = target.parameters["recordingId"] == nil ? "project.delete" : "recording.delete"
                let receipt: Deletion = try await read(operation, target.parameters)
                guard service == serviceGeneration else { return }
                guard receipt.target == target && receipt.deleted else {
                    throw Self.invalid("The service did not confirm deletion of \(target.id).")
                }
                recordingGeneration = UUID(); projectGeneration = UUID()
                recordingsReading = false; state.projectsRefreshing = false
                state.finishDelete(target, failure: nil)
                forgetExports(target); deleted()
            } catch {
                guard service == serviceGeneration else { return }
                state.finishDelete(target, failure: error.localizedDescription)
            }
            refresh()
        }
    }

    /// Uses the existing capture cadence, and only reads occupied jobs on visible source receipts.
    func tick() {
        guard ready, !jobsReading, !recordingsReading,
            state.recent.contains(where: Self.pending) else { return }
        jobsReading = true
        let service = serviceGeneration, generation = recordingGeneration
        Task { @MainActor in
            defer { if service == serviceGeneration { jobsReading = false } }
            var failure: String?
            for take in state.recent {
                guard state.deletions[.recording(take.recordingId)] == nil else { continue }
                if Self.pendingAdmission(take) {
                    do throws(ServiceFailure) {
                        let answer: ControlsState.RecentTake = try await read("recording.get", ["recordingId": take.recordingId])
                        guard service == serviceGeneration && generation == recordingGeneration else { return }
                        guard answer.recordingId == take.recordingId else { throw Self.invalid("Recording returned a different identity") }
                        try validate(answer)
                        if let index = state.recent.firstIndex(where: { $0.recordingId == take.recordingId }) { state.recent[index] = answer }
                    } catch {
                        guard service == serviceGeneration && generation == recordingGeneration else { return }
                        failure = failure ?? error.localizedDescription
                    }
                }
                for admission in take.sourceAdmissions ?? [] where Self.active(admission) {
                    do throws(ServiceFailure) {
                        let job: LibraryState.Job = try await read("job.get", ["jobId": admission.job!.jobId])
                        guard service == serviceGeneration && generation == recordingGeneration else { return }
                        guard job.jobId == admission.job!.jobId, job.target.kind == "acquisition",
                            job.target.acquisitionId == admission.acquisitionId, Self.valid(job) else {
                            throw Self.invalid("Preparation returned a different source job")
                        }
                        replaceJob(take.recordingId, admission.sourceId, job)
                    } catch {
                        guard service == serviceGeneration && generation == recordingGeneration else { return }
                        failure = failure ?? error.localizedDescription
                    }
                }
            }
            state.progressFailure = failure
        }
    }

    private static func pendingAdmission(_ take: ControlsState.RecentTake) -> Bool {
        guard take.sourceAdmissions != nil else { return false }
        return take.state == "finalizing" || take.sourceAdmissions!.contains {
            $0.admissionError == nil && ($0.acquisitionId == nil || $0.job == nil)
        }
    }
    private static func pending(_ take: ControlsState.RecentTake) -> Bool {
        pendingAdmission(take) || take.sourceAdmissions?.contains(where: active) == true
    }
    private func validate(_ take: ControlsState.RecentTake) throws(ServiceFailure) {
        let admissions = take.sourceAdmissions ?? []
        guard admissions.count <= 2, Set(admissions.map(\.kind)).count == admissions.count,
            Set(admissions.map(\.sourceId)).count == admissions.count,
            admissions.allSatisfy({ admission in
                ["primary", "camera"].contains(admission.kind) && !admission.sourceId.isEmpty
                    && (admission.job.map { $0.target.kind == "acquisition" && $0.target.acquisitionId == admission.acquisitionId && admission.acquisitionId != nil && Self.valid($0) } ?? true)
            }) else { throw Self.invalid("Unreadable source admission receipt") }
    }

    private static func valid(_ job: LibraryState.Job) -> Bool {
        !job.jobId.isEmpty && ["waiting", "queued", "running", "ready", "failed", "unavailable", "canceled"].contains(job.state)
    }
    private static func active(_ admission: LibraryState.SourceAdmission) -> Bool {
        admission.job.map { ["queued", "running", "waiting"].contains($0.state) } ?? false
    }
    private func replaceJob(_ recordingId: String, _ sourceId: String, _ job: LibraryState.Job) {
        guard let index = state.recent.firstIndex(where: { $0.recordingId == recordingId }),
            var admissions = state.recent[index].sourceAdmissions,
            let source = admissions.firstIndex(where: { $0.sourceId == sourceId }) else { return }
        let take = state.recent[index]
        admissions[source].job = job
        state.recent[index] = .init(recordingId: take.recordingId, createdAt: take.createdAt,
            state: take.state, sourceDurationUs: take.sourceDurationUs, interruptionReason: take.interruptionReason,
            finalizationError: take.finalizationError, sourceId: take.sourceId, sourceAdmissions: admissions)
    }

    private func read<T: Decodable>(_ operation: String, _ params: [String: Any]) async throws(ServiceFailure) -> T {
        let bytes = try await call(operation, params)
        do { return try JSONDecoder().decode(T.self, from: bytes) }
        catch { throw Self.invalid("Unreadable \(operation) response: \(error.localizedDescription)") }
    }
    private static func invalid(_ message: String) -> ServiceFailure { .init(code: "INVALID_RESPONSE", message: message) }
    private struct Recordings: Decodable { let recordings: [ControlsState.RecentTake] }
    private struct Projects: Decodable {
        let projects: [LibraryState.Project]; let nextCursor: LibraryState.Cursor?
        private enum Keys: String, CodingKey { case projects, nextCursor }
        init(from decoder: Decoder) throws {
            let fields = try decoder.container(keyedBy: Keys.self)
            guard fields.contains(.nextCursor) else {
                throw DecodingError.keyNotFound(Keys.nextCursor, .init(codingPath: decoder.codingPath, debugDescription: "Missing project page cursor"))
            }
            projects = try fields.decode([LibraryState.Project].self, forKey: .projects)
            nextCursor = try fields.decodeIfPresent(LibraryState.Cursor.self, forKey: .nextCursor)
        }
    }
    private struct Deletion: Decodable {
        let target: MediaTarget; let deleted: Bool
        private enum Keys: String, CodingKey { case deleted }
        init(from decoder: Decoder) throws {
            target = try MediaTarget(from: decoder)
            deleted = try decoder.container(keyedBy: Keys.self).decode(Bool.self, forKey: .deleted)
        }
    }
}
