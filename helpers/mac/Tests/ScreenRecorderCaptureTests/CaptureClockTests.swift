import CoreMedia
import ScreenRecorderCapture

func runCaptureClockTests() {
    runElapsedTests()
    try! runPCMRepresentationTests()
    var prologue = CaptureClock()
    prologue.pause(at: 10)
    precondition(
        !prologue.start(at: 20) && prologue.originUs == nil,
        "A usable frame during a pre-origin pause cannot establish source zero")
    prologue.resume(at: 30)
    precondition(
        prologue.start(at: 40) && prologue.sourceTime(for: 40) == 0,
        "The first active usable frame owns source zero after a pre-origin pause")
    precondition(
        !prologue.start(at: 50) && prologue.originUs == 40,
        "Following frames cannot move an established origin")
    var delayed = CaptureClock()
    delayed.pause(at: 10)
    delayed.resume(at: 30)
    precondition(!delayed.start(at: 20) && delayed.originUs == nil,
        "A delayed first frame whose timestamp was paused cannot establish source zero after resume")
    precondition(!delayed.start(at: 5, durationUs: 10) && delayed.originUs == nil,
        "A delayed first frame spanning a completed pause cannot establish source zero")
    precondition(delayed.start(at: 40) && delayed.sourceTime(for: 40) == 0)
    var lateOrigin = CaptureClock()
    lateOrigin.pause(at: 20)
    lateOrigin.resume(at: 50)
    precondition(lateOrigin.start(at: 10))
    precondition(lateOrigin.sourceTime(for: 60) == 20)
    precondition(lateOrigin.pauses.map(\.atSourceUs) == [10]
        && lateOrigin.pauses.map(\.elapsedPauseUs) == [30],
        "A completed pause must gain its true source marker when a valid earlier frame establishes origin")
    precondition(!lateOrigin.start(at: 11) && lateOrigin.pauses.count == 1,
        "Repeated origin attempts cannot duplicate deferred pause markers")
    precondition(delayed.pauses.isEmpty,
        "A pause wholly before the retained source origin remains unplaced")
    print("PASS source zero waits for an active usable frame")

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

private func runPCMRepresentationTests() throws {
    let origin: Int64 = 100_000_000
    for rate: Int32 in [44100, 48000, 192000] {
        var clock = CaptureClock()
        clock.start(at: origin)
        let first = try clock.recordAcceptedPCM(role: "narration",
            hostPTS: CMTime(value: origin + 100001, timescale: 1_000_000), frames: 1024, rate: rate)!
        let nanoseconds = Int64((Int128(1024) * 1_000_000_000 + Int128(rate) / 2) / Int128(rate))
        let next = try clock.recordAcceptedPCM(role: "narration",
            hostPTS: CMTime(value: (origin + 100001) * 1000 + nanoseconds, timescale: 1_000_000_000),
            frames: 1024, rate: rate)!
        precondition(first.anchorUs == 100001 && first.firstFrame == 0)
        precondition(next.anchorUs == first.anchorUs && next.firstFrame == 1024 && next.joinsPrevious)
        if rate == 48000 {
            var capacityRefused = false
            do {
                _ = try clock.recordAcceptedPCM(role: "narration",
                    hostPTS: CMTime(value: 2_000_000_000_000, timescale: 1), frames: 1, rate: rate)
            } catch let failure as CaptureFailure {
                capacityRefused = failure.code == "INVALID_AUDIO_TIMING" && failure.message.contains("capacity")
            }
            precondition(capacityRefused, "An endpoint outside exact container capacity cannot advance state")
            let delta = Int64((Int128(2048) * 1_000_000_000 + Int128(rate) / 2) / Int128(rate))
            let following = try clock.recordAcceptedPCM(role: "narration",
                hostPTS: CMTime(value: (origin + 100001) * 1000 + delta, timescale: 1_000_000_000),
                frames: 1, rate: rate)!
            precondition(following.firstFrame == 2048 && following.joinsPrevious)
        }
    }
    var unusual = CaptureClock()
    unusual.start(at: origin)
    var refused = false
    do {
        _ = try unusual.recordAcceptedPCM(role: "narration",
            hostPTS: CMTime(value: origin + 100001, timescale: 1_000_000), frames: 1024, rate: 47999)
    } catch let failure as CaptureFailure {
        refused = failure.code == "INVALID_AUDIO_TIMING" && failure.message.contains("timescale")
    }
    precondition(refused, "An unpublishable phase must be refused before prospective acceptance")
    let valid = try unusual.recordAcceptedPCM(role: "narration",
        hostPTS: CMTime(value: origin + 100000, timescale: 1_000_000), frames: 1024, rate: 47999)!
    precondition(valid.anchorUs == 100000 && valid.firstFrame == 0 && !valid.joinsPrevious,
        "A refused phase must not advance or establish accepted state")
    print("PASS exact container representability precedes PCM acceptance without changing common native phase")
}
