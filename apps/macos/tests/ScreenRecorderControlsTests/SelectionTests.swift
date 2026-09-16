import Foundation
import ScreenRecorderControls

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
    state.device = ControlsState.DeviceStatus(
        state: .idle, recordingId: nil, elapsedUs: nil,
        permissions: ControlsState.Permissions(screen: true, microphone: "authorized"))
    return state
}

func runElapsedFormatTests() {
    precondition(ElapsedTime.format(0) == "0:00", "A take that just started reads as zero")
    precondition(ElapsedTime.format(7_400_000) == "0:07", "Part seconds round down to whole ones")
    precondition(ElapsedTime.format(61_500_000) == "1:01", "Minutes and seconds read together")
    precondition(ElapsedTime.format(3_661_000_000) == "1:01:01", "An hours field appears only once there is one")
    precondition(ElapsedTime.format(3_599_000_000) == "59:59", "Just under an hour stays in minutes")
    precondition(ElapsedTime.format(nil) == "—", "A take with no measured time states none, not zero")
    print("PASS elapsed playback time reads as a recorder's clock")
}

func runSelectionTests() {
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
        #"{"source":{"kind":"window","windowId":88},"microphone":false,"systemAudio":true}"#.utf8))
    state.selection.apply(active, catalog: state.sources)
    precondition(state.selection.start() == active,
                 "An external take replaces the menu's source and both audio choices for restart")
    precondition(RecordingMenu.sourceTitle(for: state) == "Safari — Pricing",
                 "An external window resolves its catalog label")
    state.sources.windows = [.init(id: 88, title: "Checkout", application: "Safari")]
    precondition(state.reconcileSelection() == nil,
                 "A title change is not a closed window")
    precondition(RecordingMenu.sourceTitle(for: state) == "Safari — Checkout",
                 "A retained selection shows the refreshed title")
    precondition(state.selection.start()?.source == .window(id: 88),
                 "Renaming a window preserves its capture identity")
    state.sources.windows = []
    precondition(state.reconcileSelection() != nil && state.selection.source == nil,
                 "A missing window is visibly deselected")
    print("PASS a selection becomes exactly the take it describes")
}
