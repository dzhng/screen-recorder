import AppKit
import YapControls

@main struct LibraryViewCheck {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        var state = ControlsState()
        state.service = .ready
        state.library.recent = [.init(recordingId: "fixture-recording", createdAt: "2026-10-05T19:18:00Z", state: "complete", sourceDurationUs: 154_000_000, interruptionReason: nil)]
        var actions: [ControlsAction] = []
        let view = LibraryView(state: state, exports: ExportsState()) { actions.append($0) }
        guard let action = view.actionItem(identifier: "recording.delete.fixture-recording") else {
            preconditionFailure("The recording's explicit delete remains reachable")
        }
        NSApplication.shared.sendAction(action.action!, to: action.target, from: action)
        precondition(actions == [.deleteRecording("fixture-recording")], "The native Library preserves shared action identity")
        let denied = LibraryView(state: ControlsState(), exports: ExportsState()) { actions.append($0) }
        denied.update(state: { var locked = state; locked.service = .unavailable("fixture service failure"); return locked }(), exports: ExportsState())
        let deniedDelete = denied.actionItem(identifier: "recording.delete.fixture-recording")!
        precondition(!deniedDelete.isEnabled, "Unavailable service keeps native delete inapplicable")
        NSApplication.shared.sendAction(deniedDelete.action!, to: deniedDelete.target, from: deniedDelete)
        precondition(actions == [.deleteRecording("fixture-recording")], "Inapplicable Library actions cannot escape")
        let output = CommandLine.arguments[1]
        var observations: [[String: Any]] = []
        for (name, facts, deliveries, tab, height) in [
            ("recordings", fixture(), ExportsState(), LibraryView.Tab.recordings, CGFloat(476)),
            ("projects", fixture(), ExportsState(), .projects, CGFloat(476)),
            ("exports", fixture(), exportFixture(), .exports, CGFloat(476)),
            ("empty", ControlsState(), ExportsState(), .recordings, CGFloat(476)),
            ("deletion", deletionFixture(), ExportsState(), .recordings, CGFloat(476)),
            ("long-details", fixture(long: true), ExportsState(), .recordings, CGFloat(476)),
            ("short-screen", fixture(long: true), ExportsState(), .recordings, CGFloat(280)),
        ] {
            let content = LibraryView(state: facts, exports: deliveries) { actions.append($0) }
            content.frame.size = NSSize(width: 768, height: height)
            let shot = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 768, height: height), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            shot.title = "Library · Synthetic presentation fixture"
            shot.isReleasedWhenClosed = false
            shot.appearance = NSAppearance(named: .aqua)
            shot.contentView = content
            shot.orderBack(nil)
            (content.control(identifier: "tab.\(tab.rawValue.lowercased())") as! NSButton).performClick(nil)
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
            content.layoutSubtreeIfNeeded()
            func save(_ suffix: String) {
                let frame = content.superview!
                let bitmap = frame.bitmapImageRepForCachingDisplay(in: frame.bounds)!
                frame.cacheDisplay(in: frame.bounds, to: bitmap)
                try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(output)/\(name)\(suffix).png"))
            }
            save("")
            let doc = content.scrollView.documentView!
            var controlFrames: [String: [Double]] = [:]
            var ids = ["library.filter"]
            switch tab {
            case .recordings: ids += facts.library.recent.map { "actions.\($0.recordingId)" }
            case .projects: ids += ["library.projects.previous", "library.projects.next"] + facts.library.projects.map { "actions.\($0.projectId)" }
            case .exports: ids += deliveries.records.map { "actions.\($0.exportId)" }
            }
            for id in ids {
                if let control = content.control(identifier: id) {
                    let rect = control.convert(control.bounds, to: doc)
                    controlFrames[id] = [rect.minX, rect.minY, rect.width, rect.height]
                }
            }
            observations.append(["fixture": name, "facts": "synthetic", "contentWidthPoints": 768, "contentHeightPoints": height, "backingScale": shot.backingScaleFactor, "appearance": "aqua", "controls": controlFrames])
            try! JSONSerialization.data(withJSONObject: observations, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: "\(output)/native-metadata.json"))
            for id in ids {
                if let control = content.control(identifier: id) {
                    let rect = control.convert(control.bounds, to: doc)
                    doc.scrollToVisible(rect)
                    content.scrollView.reflectScrolledClipView(content.scrollView.contentView)
                    precondition(content.scrollView.contentView.bounds.contains(rect), "Full action menu must be reachable: \(id)")
                }
            }
            if name == "short-screen" {
                doc.scrollToVisible(NSRect(x: 0, y: doc.bounds.height - 1, width: 1, height: 1))
                content.scrollView.reflectScrolledClipView(content.scrollView.contentView)
                RunLoop.current.run(until: Date().addingTimeInterval(0.1))
                save("-bottom")
                precondition(content.scrollView.contentView.bounds.minY > 0, "Long details scroll at native control size")
            }
            if name == "recordings" {
                let field = content.control(identifier: "library.filter") as! NSSearchField
                field.stringValue = "fixture-recording-two"
                content.controlTextDidChange(Notification(name: NSControl.textDidChangeNotification, object: field))
                precondition(content.actionItem(identifier: "recording.delete.fixture-recording-one") == nil, "Filter is limited to displayed observations")
                precondition(content.actionItem(identifier: "recording.delete.fixture-recording-two") != nil)
                content.clearPageFilter()
                precondition(content.actionItem(identifier: "recording.delete.fixture-recording-one") != nil, "Explicit page reset clears the presentation filter")
            }
            if name == "exports" {
                let retry = content.actionItem(identifier: "export.retry.fixture-export")!
                precondition(retry.title == "Retry Cleanup", "Committed export actions retain cleanup meaning")
                NSApplication.shared.sendAction(retry.action!, to: retry.target, from: retry)
                precondition(actions.last == .retryExport("fixture-export"))
            }
            shot.orderOut(nil)
            shot.close()
        }
    }
    @MainActor static func fixture(long: Bool = false) -> ControlsState {
        var state = ControlsState()
        state.service = .ready
        state.storage = .init(totalBytes: 2_400_000_000, observedAt: "2026-10-05T19:18:00Z")
        state.library.recent = [
            .init(recordingId: "fixture-recording-one", createdAt: "2026-10-05T19:18:00Z", state: "complete", sourceDurationUs: 154_000_000, interruptionReason: nil),
            .init(recordingId: long ? "recording-with-a-very-long-identity-for-a-camera-and-narration-observation-that-must-wrap" : "fixture-recording-two", createdAt: "2026-10-05T17:42:00Z", state: "finalizing", sourceDurationUs: 48_000_000, interruptionReason: nil, finalizationError: long ? .init(code: "FIXTURE_FINALIZATION", message: "A selected conference room camera source remains unavailable while the recording's publication is being inspected. Retry belongs to its existing owner.", retryable: true) : nil, sourceId: long ? "source-with-a-very-long-identity-that-remains-visible-without-displacing-the-action-menu" : nil),
            .init(recordingId: "fixture-recording-three", createdAt: "2026-10-04T23:06:00Z", state: "complete", sourceDurationUs: 312_000_000, interruptionReason: nil),
        ]
        if long {
            let admissions = """
            [{"kind":"camera","sourceId":"fixture-camera-source","publication":{"state":"unavailable","error":{"code":"FIXTURE_PUBLICATION","message":"Selected conference camera publication remains unavailable."}}}]
            """
            let sources = try! JSONDecoder().decode([LibraryState.SourceAdmission].self, from: Data(admissions.utf8))
            let last = state.library.recent[1]
            state.library.recent[1] = .init(recordingId: last.recordingId, createdAt: last.createdAt, state: last.state, sourceDurationUs: last.sourceDurationUs, interruptionReason: last.interruptionReason, finalizationError: last.finalizationError, sourceId: last.sourceId, sourceAdmissions: sources)
        }
        let projectJSON = """
        [{"projectId":"fixture-project","title":"Product demonstration","createdAt":"2026-10-05T19:18:00Z","currentRevisionId":"fixture-revision"}]
        """
        state.library.projects = try! JSONDecoder().decode([LibraryState.Project].self, from: Data(projectJSON.utf8))
        return state
    }
    @MainActor static func deletionFixture() -> ControlsState {
        var state = fixture()
        _ = state.library.beginDelete(.recording("fixture-recording-one"))
        state.library.finishDelete(.recording("fixture-recording-one"), failure: "Fixture request was not confirmed; original source remains intact.")
        return state
    }
    static func exportFixture() -> ExportsState {
        var state = ExportsState()
        state.records = [.init(exportId: "fixture-export", target: .project("fixture-project"), kind: .video, revisionId: "fixture-revision", state: "committed", directory: "/Synthetic/Exports", leaf: "Product demonstration.mp4", output: "/Synthetic/Exports/Product demonstration.mp4", reason: "Committed output is intact; private cleanup still needs retry.", retryable: true, abandoning: false, cleanupPending: true)]
        return state
    }

}
