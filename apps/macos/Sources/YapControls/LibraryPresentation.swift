import Foundation

/// Shared saved-media facts and action applicability; renderers consume these directly.
public enum LibraryPresentation {
    public static func agentPrompt(for recordingId: String) -> String {
        "I want you to use this recording with this ID with the Yap CLI: \(recordingId)"
    }

    public static func recordings(for state: ControlsState) -> SavedPage {
        let takes = state.library.recent + state.library.deletions.values.compactMap(\.take)
            .filter { pending in !state.library.recent.contains { $0.recordingId == pending.recordingId } }
            .sorted { $0.recordingId < $1.recordingId }
        let actions: [PresentedControlsAction] = [
            .init(.previousRecordings, "Previous", enabled: state.service == .ready && state.library.hasPreviousRecordingPage && !state.library.recordingsRefreshing),
            .init(.nextRecordings, "Next", enabled: state.service == .ready && state.library.nextRecordingCursor != nil && !state.library.recordingsRefreshing),
            .init(.refreshLibrary, "Refresh", enabled: state.service == .ready && !state.library.recordingsRefreshing),
        ]
        var notices: [SavedItem] = []
        if let failure = state.library.recordingFailure { notices.append(.init(id: "recordings.failure", kind: .message, title: "Recordings unavailable — \(failure)")) }
        if let failure = state.library.progressFailure { notices.append(.init(id: "recordings.progress", kind: .message, title: "Preparation status unavailable — \(failure)")) }
        guard !takes.isEmpty else {
            return .init(items: notices + [.init(id: "recordings.empty", kind: .message, title: "No recordings on this page.")], actions: actions)
        }
        return .init(items: notices + takes.map { take in
            let request = state.library.deletions[.recording(take.recordingId)]
            let pending = request?.isPending == true
            var details: [String] = []
            if take.sourceAdmissions?.contains(where: { $0.kind == "primary" && $0.publication?.state == .published }) == true {
                details.append("Microphone audio")
            }
            if let failure = take.finalizationError { details.append("Finalization failed — \(failure.code): \(failure.message)") }
            if let failure = request?.failure { details.append("Delete not confirmed — \(failure)") }
            let suffix = pending ? " — deleting…" : request == nil ? "" : " — delete not confirmed"
            let status = request != nil ? pending ? "Deleting" : "Attention" : take.finalizationError != nil ? "Attention" : take.state == "complete" ? "Ready" : take.state.capitalized
            return .init(id: take.recordingId, kind: .recording, title: recordingTitle(of: take) + suffix,
                status: status, details: details, actions: [
                    .init(.playRecording(take.recordingId), "Play", enabled: state.service == .ready && !pending && take.state != "canceled"),
                    .init(.copyRecordingPrompt(take.recordingId), "Copy agent prompt", enabled: !pending),
                ])
        }, actions: actions)
    }

    public static func projects(for state: ControlsState, exports: ExportsState) -> SavedPage {
        var items: [SavedItem] = []
        if let failure = state.library.projectFailure { items.append(.init(id: "projects.failure", kind: .message, title: "Projects unavailable — \(failure)")) }
        if state.library.projectsRefreshing { items.append(.init(id: "projects.refreshing", kind: .message, title: "Reading projects…")) }
        for project in state.library.projects {
            let request = state.library.deletions[.project(project.projectId)]
            guard request == nil else { continue }
            let usable = state.service == .ready
            items.append(.init(id: project.projectId, kind: .project, title: project.title, status: "Project", details: [project.projectId, project.currentRevisionId], actions: [
                .init(.previewProject(project.projectId), "Preview", enabled: usable),
                .init(.exportProject(project.projectId, .video), "Export Video…", enabled: usable && exports.choosing == nil),
                .init(.exportProject(project.projectId, .package), "Export AI Package…", enabled: usable && exports.choosing == nil),
                .init(.deleteProject(project.projectId), "Delete Project", enabled: usable),
            ]))
        }
        for request in state.library.deletions.values.sorted(by: { $0.target.id < $1.target.id }) {
            guard case .project(let id) = request.target else { continue }
            items.append(.init(id: id, kind: .project, title: request.title, status: request.isPending ? "Deleting" : "Attention", details: [
                id, request.failure.map { "Delete not confirmed — \($0)" } ?? "Deleting…",
            ], actions: [.init(.deleteProject(id), request.isPending ? "Deleting…" : "Retry Delete", enabled: state.service == .ready && !request.isPending)]))
        }
        if state.library.projects.isEmpty && items.isEmpty { items.append(.init(id: "projects.empty", kind: .message, title: "No projects on this page.")) }
        return .init(items: items, actions: [
            .init(.previousProjects, "Previous Projects", enabled: state.service == .ready && state.library.hasPreviousProjectPage && !state.library.projectsRefreshing),
            .init(.nextProjects, "Next Projects", enabled: state.service == .ready && state.library.nextProjectCursor != nil && !state.library.projectsRefreshing),
        ])
    }

    public static func recordingTitle(of take: ControlsState.RecentTake) -> String {
        let when = ElapsedTime.shortTime(of: take.createdAt)
        switch take.state {
        case "complete": return "\(when) — \(ElapsedTime.format(take.sourceDurationUs))"
        case "interrupted":
            let duration = take.sourceDurationUs.map { " \(ElapsedTime.format($0))" } ?? ""
            return "\(when) — interrupted\(duration)"
        default: return "\(when) — \(take.state)"
        }
    }
}
