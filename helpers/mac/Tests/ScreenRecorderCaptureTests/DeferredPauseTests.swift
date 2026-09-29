import Foundation
import ScreenRecorderCapture
import ScreenRecorderWire

private struct NormalizedPause: Decodable {
    let event: String
    let data: PauseEvent
}

func runDeferredPauseTests() async throws {
    // Both completed pauses precede delivery of source zero; its host timestamp decides which
    // intervals the retained source actually crosses. Earlier prologue controls stay unplaced.
    for (origin, expected, sourceAt600) in [
        (Int64(50), [[Int64(50), 100], [150, 200]], Int64(250)),
        (Int64(250), [[Int64(50), 200]], Int64(150)),
        (Int64(550), [[Int64]](), Int64(50)),
    ] {
        let root = RecoveryFixture.directory("deferred-pauses")
        defer { try? FileManager.default.removeItem(at: root) }
        let directory = root.appendingPathComponent("source")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let journal = try CaptureJournal(
            directory: directory.path,
            header: CaptureJournalHeader(
                schemaVersion: 1, sessionID: "deferred",
                source: CaptureSource(kind: "window", windowID: 1),
                width: 160, height: 120, microphone: false, systemAudio: false))
        var clock = CaptureClock()
        func pause(_ host: Int64) throws {
            clock.pause(at: host)
            try journal.recordPauseBegan(hostUs: host)
        }
        func resume(_ host: Int64) throws {
            let wasPaused = clock.isPaused
            let count = clock.pauses.count
            clock.resume(at: host)
            if wasPaused {
                try journal.recordPauseEnded(
                    hostUs: host,
                    pause: clock.pauses.count > count ? clock.pauses.last : nil)
            }
        }
        func start(_ host: Int64) throws {
            if clock.start(at: host) {
                try journal.recordOrigin(hostUs: host, placedPauses: clock.pauses)
            }
        }
        try pause(100)
        try resume(200)
        try pause(300)
        try resume(500)
        try pause(700)
        try start(origin)
        try start(origin + 1)
        precondition(
            clock.sourceTime(for: 600) == sourceAt600,
            "The media clock must subtract exactly the pauses its source crosses")
        precondition(clock.pauses.map { [$0.atSourceUs, $0.elapsedPauseUs] } == expected)
        let recovered = await MediaRecovery.inspect(directory: directory.path)
        precondition(
            recovered.journal?.pauses == clock.pauses && recovered.journalFailure == nil,
            "Recovery must expose each newly placeable marker exactly once")
        precondition(
            recovered.journal?.openPauseHostUs == 700,
            "Placing older completed pauses must not close the newer open pause")
        var streamed: [PauseEvent] = []
        let summary = try CaptureJournal.streamEvidence(
            directory: directory.path, pause: { streamed.append($0) })
        precondition(
            streamed == clock.pauses && summary.pauses.isEmpty && summary.openPauseHostUs == 700)
        let before = try Data(contentsOf: directory.appendingPathComponent("capture.journal.jsonl"))
        let output = root.appendingPathComponent("evidence.jsonl")
        let receipt = try await SourceEvidenceExport.write(directory: directory.path, output: output.path)
        let normalized = try String(contentsOf: output, encoding: .utf8).split(separator: "\n").map
        {
            try JSONDecoder().decode(NormalizedPause.self, from: Data($0.utf8))
        }
        precondition(
            normalized.allSatisfy { $0.event == "pause" } && normalized.map(\.data) == clock.pauses)
        precondition(receipt.pauseEvents == expected.count && receipt.openPauseHostUs == 700)
        let after = try Data(contentsOf: directory.appendingPathComponent("capture.journal.jsonl"))
        precondition(before == after, "Normalized export cannot rewrite the original raw controls")
        try resume(900)
        try resume(950)
        let final = try CaptureJournal.inspect(directory: directory.path)
        precondition(final.pauses == clock.pauses && final.pauses.count == expected.count + 1)
        precondition(
            final.pauses.last?.atSourceUs == sourceAt600 + 100
                && final.pauses.last?.elapsedPauseUs == 200 && final.openPauseHostUs == nil,
            "An ordinary post-origin resume appends one marker without duplicating deferred markers"
        )
    }
    print(
        "PASS deferred pause placement preserves native source timing, recovery, streaming and open controls"
    )
}
