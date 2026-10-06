import Foundation
import YapControls

private func live(_ deviceState: ControlsState.DeviceState, elapsedUs: Int64? = 65_000_000)
    -> ControlsState
{
    var state = ready()
    state.device = ControlsState.DeviceStatus(
        state: deviceState, recordingId: "take-1", elapsedUs: elapsedUs)
    return state
}

func runRecordingOverlayTests() {
    precondition(
        RecordingOverlay.presentation(for: ready()) == nil,
        "An idle app floats nothing over what a person is doing")

    guard let recording = RecordingOverlay.presentation(for: live(.recording)) else {
        preconditionFailure("A recording take has controls on screen")
    }
    precondition(
        recording == RecordingOverlay.Presentation(
            elapsed: "1:05", paused: false, symbol: "record.circle.fill"),
        "The controls read the take's own playback time and the menu bar's own mark: \(recording)")

    guard let paused = RecordingOverlay.presentation(for: live(.paused, elapsedUs: 65_000_000))
    else { preconditionFailure("A paused take keeps its controls, or it cannot be resumed") }
    precondition(
        paused == RecordingOverlay.Presentation(
            elapsed: "1:05", paused: true, symbol: "pause.circle"),
        "A pause holds the elapsed marker it stopped at, and says so with a mark of its own rather "
            + "than a colour alone: \(paused)")

    for ending in [ControlsState.DeviceState.finalizing, .selecting, .idle] {
        precondition(
            RecordingOverlay.presentation(for: live(ending)) == nil,
            "\(ending) is no take to control, so nothing floats")
    }

    var lost = live(.recording)
    lost.service = .unavailable("Node 24 was not found")
    precondition(
        RecordingOverlay.presentation(for: lost) == nil,
        "A service that cannot answer leaves no controls offering operations it cannot carry")
    print("PASS the floating controls appear exactly while a take is live")
}

func runCountdownTests() {
    guard var counting = Countdown(seconds: Countdown.defaultSeconds) else {
        preconditionFailure("A start counts down before it records")
    }
    var shown = [counting.remaining]
    while counting.tick() { shown.append(counting.remaining) }
    precondition(shown == [3, 2, 1], "The count reads three, two, one and then records: \(shown)")
    precondition(counting.remaining == 0, "Nothing is shown once the count has been spent")

    for none in [0, -1] {
        precondition(
            Countdown(seconds: none) == nil,
            "A count of \(none) starts capture immediately rather than showing a number")
    }
    print("PASS the count runs three, two, one, and a count of zero starts at once")
}
