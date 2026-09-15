import ScreenRecorderCapture

func runCaptureClockTests() {

    var clock = CaptureClock()
    clock.start(at: 100_000_000)
    clock.pause(at: 102_000_000)
    precondition(clock.sourceTime(for: 103_000_000) == nil, "Paused samples must be omitted")
    clock.resume(at: 105_000_000)
    precondition(
        clock.sourceTime(for: 106_000_000) == 3_000_000, "Resume must remove elapsed pause time")
    precondition(
        clock.pauses.count == 1 && clock.pauses[0].atSourceUs == 2_000_000
            && clock.pauses[0].elapsedPauseUs == 3_000_000,
        "Pause event must retain source boundary and elapsed duration")
    print("PASS pause mapping and event")
    precondition(
        clock.sourceTime(for: 101_990_000, durationUs: 20_000) == nil,
        "Audio spanning a pause must not leak paused speech")
    precondition(
        clock.sourceTime(for: 104_990_000, durationUs: 20_000) == nil,
        "Audio spanning resume must not leak paused speech")
    precondition(
        clock.sourceTime(for: 101_000_000) == 1_000_000,
        "Delayed pre-pause samples retain their own epoch")
    precondition(clock.sourceTime(for: 99_999_999) == nil, "Samples before first video are omitted")
    clock.pause(at: 107_000_000)
    clock.pause(at: 108_000_000)
    clock.resume(at: 109_000_000)
    clock.resume(at: 110_000_000)
    precondition(
        clock.sourceTime(for: 405_000_000) == 300_000_000,
        "Five minutes source time must omit both pauses")
    precondition(
        clock.pauses.count == 2 && clock.pauses[1].atSourceUs == 4_000_000
            && clock.pauses[1].elapsedPauseUs == 2_000_000, "Repeated controls are idempotent")
    print("PASS delayed samples, boundary audio, and repeated pauses")
    var generations = CaptureGeneration()
    let firstTake = generations.begin()
    generations.end(firstTake)
    let secondTake = generations.begin()
    var acceptedErrors: [String] = []
    if generations.accepts(firstTake) { acceptedErrors.append("old writer failed") }
    if generations.accepts(secondTake) { acceptedErrors.append("current writer failed") }
    precondition(
        acceptedErrors == ["current writer failed"],
        "An old take's delayed failure must not interrupt a restarted take")
    generations.end(firstTake)
    precondition(
        generations.accepts(secondTake), "An old finalizer must not invalidate a restarted take")
    generations.end(secondTake)
    precondition(!generations.accepts(secondTake), "A finalized take cannot accept delayed errors")
    print("PASS stale failure and finalizer after restart")
}
