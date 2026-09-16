import ScreenRecorderCapture

func runCaptureClockTests() {
    runElapsedTests()

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


/// Elapsed playback time is what a recording control displays. It is the take's own source time,
/// so it freezes while the take is paused and never counts paused wall time.
private func runElapsedTests() {
    var clock = CaptureClock()
    precondition(
        clock.elapsedSourceUs(at: 100_000_000) == nil,
        "A take with no video yet holds no playback time")
    clock.start(at: 100_000_000)
    precondition(clock.elapsedSourceUs(at: 100_000_000) == 0, "Source time starts at zero")
    precondition(
        clock.elapsedSourceUs(at: 101_500_000) == 1_500_000, "Elapsed time follows the media clock")
    clock.pause(at: 102_000_000)
    precondition(
        clock.elapsedSourceUs(at: 103_000_000) == 2_000_000,
        "A paused take freezes at the playback time it reached")
    precondition(
        clock.elapsedSourceUs(at: 190_000_000) == 2_000_000,
        "A long pause adds no playback time however long it lasts")
    clock.resume(at: 105_000_000)
    precondition(
        clock.elapsedSourceUs(at: 106_000_000) == 3_000_000,
        "A resumed take continues from where it paused")
    clock.pause(at: 107_000_000)
    clock.resume(at: 110_000_000)
    precondition(
        clock.elapsedSourceUs(at: 111_000_000) == 5_000_000,
        "Every pause is removed from elapsed playback time")
    precondition(
        clock.elapsedSourceUs(at: 111_000_000) == clock.sourceTime(for: 111_000_000),
        "Elapsed time and sample placement share one clock")
    clock.seal(at: 112_000_000)
    precondition(clock.elapsedSourceUs(at: 150_000_000) == 6_000_000,
                 "Finalization cannot add playback time past the sealed endpoint")
    clock.seal(at: 160_000_000)
    precondition(clock.elapsedSourceUs(at: 170_000_000) == 6_000_000,
                 "Repeated sealing preserves the first endpoint")
    var paused = CaptureClock()
    paused.start(at: 10)
    paused.pause(at: 20)
    paused.seal(at: 30)
    precondition(paused.elapsedSourceUs(at: 100) == 10,
                 "Sealing a paused take retains its paused endpoint")
    print("PASS elapsed playback time freezes across pauses and finalization")
}
