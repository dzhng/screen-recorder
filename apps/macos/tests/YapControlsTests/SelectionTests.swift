import Foundation
import YapControls

let display = ControlsState.Display(id: 3, name: "Studio Display", width: 2560, height: 1440)
let window = ControlsState.Window(id: 88, title: "Pricing", application: "Safari")
let builtIn = ControlsState.Microphone(id: "mic-built-in", name: "MacBook Pro Microphone", isDefault: true)
let headset = ControlsState.Microphone(id: "mic-headset", name: "Studio Headset", isDefault: false)

/// A state with a chosen source and a listed catalog, which most checks start from.
func ready(source: ControlsState.SelectedSource? = .display(display)) -> ControlsState {
    var state = ControlsState()
    state.service = .ready
    state.sources = ControlsState.SourceCatalog(
        displays: [display], windows: [window], microphones: [builtIn, headset])
    state.selection.source = source
    state.device = ControlsState.DeviceStatus(state: .idle, recordingId: nil, elapsedUs: nil)
    state.permissions = ControlsState.Permissions(screen: .granted, microphone: .granted)
    return state
}

func runElapsedFormatTests() {
    precondition(ElapsedTime.format(0) == "0:00", "A take that just started reads as zero")
    precondition(ElapsedTime.format(7_400_000) == "0:07", "Part seconds round down to whole ones")
    precondition(ElapsedTime.format(61_500_000) == "1:01", "Minutes and seconds read together")
    precondition(ElapsedTime.format(3_661_000_000) == "1:01:01", "An hours field appears only once there is one")
    precondition(ElapsedTime.format(3_599_000_000) == "59:59", "Just under an hour stays in minutes")
    precondition(ElapsedTime.format(nil) == "—", "A take with no measured time states none, not zero")
    precondition(ElapsedTime.shortTime(of: "2026-09-16T09:10:11.000Z") == ElapsedTime.shortTime(of: "2026-09-16T09:10:11Z"),
        "Service timestamps with milliseconds keep their readable local date")
    print("PASS elapsed playback time reads as a recorder's clock")
}

/// A microphone somebody chose is theirs whether or not it is plugged in today.
func runAwaitedMicrophoneTests() {
    var state = ready()
    state.selection.microphone = .device(id: headset.id, name: headset.name)

    state.observeSources(ControlsState.SourceCatalog(
        displays: [display], windows: [window], microphones: [builtIn]))
    precondition(
        state.selection.microphone == .systemDefault,
        "A take cannot be narrated through a microphone that is not there")
    precondition(
        state.selection.awaitedMicrophone == .device(id: headset.id, name: headset.name),
        "The choice is remembered rather than thrown away")
    precondition(
        state.selection.recordingDefaults.microphone == .device(id: headset.id, name: headset.name),
        "What is saved is what this person chose, not what today's Mac happens to have")
    precondition(
        CapturePresentation.microphoneTitle(for: state) == "system default, waiting for Studio Headset",
        "The capture label says which input it is waiting for, got \(CapturePresentation.microphoneTitle(for: state))")

    state.observeSources(ControlsState.SourceCatalog(
        displays: [display], windows: [window], microphones: [builtIn, headset]))
    precondition(
        state.selection.microphone == .device(id: headset.id, name: headset.name)
            && state.selection.awaitedMicrophone == nil,
        "Plugged back in, it is selected again without being chosen a second time")
    print("PASS an unplugged microphone stays this person's choice")
}

func runSelectionTests() {
    var defaultCamera = ControlsState()
    defaultCamera.observeSources(.init(cameras: [
        .init(id: "external", name: "External"),
        .init(id: "default", name: "Default camera", isDefault: true),
    ]))
    defaultCamera.selectDefaultCameraIfNeeded(enabled: false)
    precondition(defaultCamera.selection.cameraDeviceId == nil, "Discovery must leave disabled camera capture off")
    defaultCamera.selectDefaultCameraIfNeeded(enabled: true)
    precondition(defaultCamera.selection.cameraDeviceId == "default", "Enabling camera capture chooses the native default, not the first device")
    defaultCamera.selection.cameraDeviceId = "external"
    defaultCamera.selectDefaultCameraIfNeeded(enabled: true)
    precondition(defaultCamera.selection.cameraDeviceId == "external", "Refresh preserves a chosen camera identity")
    let cameraData = Data(#"{"source":{"kind":"camera","deviceId":"selected-camera"},"microphone":false,"systemAudio":false}"#.utf8)
    guard let cameraStart = try? JSONDecoder().decode(ControlsState.CaptureSelection.Start.self, from: cameraData) else {
        preconditionFailure("A primary camera start crosses the shared controls boundary")
    }
    var cameraState = ControlsState()
    cameraState.selection.apply(cameraStart, catalog: cameraState.sources)
    precondition(cameraState.selection.start() == cameraStart,
                 "An external primary camera retains its exact device identity for restart")
    let cameraRestart = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(cameraState.selection.start()!)) as! [String: Any]
    precondition(cameraRestart["cameraDeviceId"] == nil,
                 "A primary camera never emits a companion camera selection")
    precondition(cameraState.beginStart(newRequestId: "missing-camera") == nil,
                 "An unavailable selected camera cannot start or substitute another device")
    cameraState.observeSources(.init(cameras: [.init(id: "selected-camera", name: "Studio Camera")]))
    precondition(cameraState.beginStart(newRequestId: "available-camera")?.start == cameraStart,
                 "An explicit available camera starts with no discovered screen")
    cameraState.sourcesUnavailable(description: "Screen listing was refused")
    precondition(cameraState.sources.cameras.first?.id == "selected-camera"
                 && cameraState.selection.cameraDeviceId == "selected-camera",
                 "A failed screen listing cannot erase independent camera discovery or its choice")
    cameraState.observeSources(.init())
    let replay = cameraState.beginStart(newRequestId: "must-not-allocate")
    precondition(replay?.requestId == "available-camera" && replay?.repeatsUnanswered == true,
                 "A disconnected camera cannot prevent resolving its unanswered allocation")
    if let replay { _ = cameraState.finishStart(replay, .ended) }
    precondition(cameraState.beginStart(newRequestId: "disconnected-fresh") == nil,
                 "After resolving the old allocation a disconnected camera cannot start a new take")
    var state = ControlsState()
    precondition(state.selection.start() == nil, "Nothing starts until a person chooses a source")
    precondition(
        state.selection.microphone == .systemDefault && state.selection.systemAudio == false,
        "These takes are narrated: the microphone starts on and the machine's own sound off")

    state = ready(source: .window(window))
    guard let narrated = state.selection.start() else { preconditionFailure("A chosen source starts") }
    precondition(
        narrated == .init(source: .window(id: 88), microphone: true, microphoneDeviceId: nil, systemAudio: false),
        "A default start records the chosen window with narration and no system audio")

    state.selection.microphone = .device(id: headset.id, name: headset.name)
    state.selection.systemAudio = true
    precondition(
        state.selection.start()
            == .init(source: .window(id: 88), microphone: true, microphoneDeviceId: "mic-headset", systemAudio: true),
        "A named input and system audio are both carried explicitly")

    state.selection.microphone = .off
    precondition(
        state.selection.start()
            == .init(source: .window(id: 88), microphone: false, microphoneDeviceId: nil, systemAudio: true),
        "Turning narration off refuses the microphone and keeps no device behind it")

    state.selection.source = .region(
        ControlsState.Region(
            displayId: 3, displayName: "Studio Display", x: 40, y: 120, width: 800, height: 600))
    precondition(
        state.selection.start()?.source == .region(displayId: 3, x: 40, y: 120, width: 800, height: 600),
        "A region start carries the display-local rectangle it was selected as")
    let active = try! JSONDecoder().decode(ControlsState.CaptureSelection.Start.self, from: Data(
        #"{"source":{"kind":"window","windowId":88},"microphone":false,"systemAudio":true,"cameraDeviceId":"selected-camera"}"#.utf8))
    state.selection.apply(active, catalog: state.sources)
    precondition(state.selection.start() == active,
                 "An external take replaces the selected source and both audio choices for restart")
    let restart = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(state.selection.start()!)) as! [String: Any]
    precondition(restart["cameraDeviceId"] as? String == "selected-camera",
                 "Reconstructed requests retain the external caller's camera, without choosing a fallback")
    let unavailable = try! JSONDecoder().decode(LibraryState.SourceAdmission.self, from: Data(
        #"{"kind":"camera","sourceId":"camera-source","acquisitionId":null,"job":null,"admissionError":null,"publication":{"state":"unavailable","error":{"code":"NO_CAMERA","message":"No usable camera pictures"}}}"#.utf8))
    precondition(unavailable.title == "camera publication unavailable — NO_CAMERA: No usable camera pictures",
                 "A terminal camera failure cannot be presented as waiting for admission")
    precondition(CapturePresentation.sourceTitle(for: state) == "Safari — Pricing",
                 "An external window resolves its catalog label")
    let checkout = ControlsState.Window(id: 88, title: "Checkout", application: "Safari")
    state.observeSources(.init(displays: [display], windows: [checkout], microphones: []))
    precondition(state.failure == nil, "A title change is not a closed window")
    precondition(CapturePresentation.sourceTitle(for: state) == "Safari — Checkout",
                 "A retained selection shows the refreshed title")
    precondition(state.selection.start()?.source == .window(id: 88),
                 "Renaming a window preserves its capture identity")
    state.observeSources(.init(displays: [display], windows: [], microphones: []))
    precondition(state.failure != nil && state.selection.source == nil,
                 "A missing window is visibly deselected")
    state.failure = nil
    state.observeSources(.init(displays: [display], windows: [], microphones: []))
    precondition(state.selection.start() == nil,
                 "A source that disappeared is never replaced by a display nobody chose")

    var fresh = ControlsState()
    fresh.observeSources(.init(displays: [display], windows: [window], microphones: []))
    precondition(fresh.selection.source == .display(display),
                 "Before anything was selected, the first display is offered")

    var failing = ready(source: .window(window))
    failing.sourcesUnavailable(description: "TIMEOUT: capture.sources did not answer in time")
    precondition(
        failing.selection.source == .window(window) && failing.sources.windows == [window]
            && failing.failure == "TIMEOUT: capture.sources did not answer in time",
        "A catalog read that failed keeps the selection and states its own failure")
    print("PASS a selection becomes exactly the take it describes")
}

func runStartRequestTests() {
    var state = ready(source: .window(window))
    guard let first = state.beginStart(newRequestId: "first") else { preconditionFailure("A chosen source starts") }
    precondition(first.requestId == "first" && !first.repeatsUnanswered, "A first start is a new request")
    precondition(state.beginStart(newRequestId: "double")?.requestId == "first",
                 "Pressing Start again while the answer is in flight asks for the same take")
    precondition(!state.finishStart(first, .init(failureCode: "TIMEOUT")), "A lost answer asks for nothing yet")

    guard let replay = state.beginStart(newRequestId: "second") else { preconditionFailure("A replay starts") }
    precondition(replay.requestId == "first" && replay.repeatsUnanswered,
                 "Asking again resolves the take the unanswered request allocated")
    precondition(!state.finishStart(replay, .init(failureCode: "UNRESOLVED_START")),
                 "A start the service has not proved yet stays unanswered")
    guard let settled = state.beginStart(newRequestId: "third") else { preconditionFailure("A replay starts") }
    precondition(settled.requestId == "first", "An unproved start is still asked for under its own ID")
    precondition(state.finishStart(settled, .init(recordingState: "interrupted")),
                 "A replay that resolves to an ended take recorded nothing, so the start asks again")
    guard let next = state.beginStart(newRequestId: "fourth") else { preconditionFailure("A new start") }
    precondition(next.requestId == "fourth" && !next.repeatsUnanswered,
                 "Once the lost start is settled, the next press allocates a new take")
    precondition(!state.finishStart(next, .init(recordingState: "recording")) && state.unansweredStart == nil,
                 "A live answer settles the request")

    guard let lost = state.beginStart(newRequestId: "fifth") else { preconditionFailure("A new start") }
    _ = state.finishStart(lost, .init(failureCode: "SERVICE_STOPPED"))
    state.selection.systemAudio.toggle()
    precondition(state.beginStart(newRequestId: "sixth")?.requestId == "sixth",
                 "A different selection is a different take, not a replay")
    guard let refused = state.unansweredStart else { preconditionFailure("A start is in flight") }
    precondition(!state.finishStart(refused, .init(failureCode: "INVALID_STATE")) && state.unansweredStart == nil,
                 "A refusal leaves nothing to resolve")
    print("PASS a start whose answer was lost is resolved once, then a new take is asked for")
}
