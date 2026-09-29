import Darwin
import Foundation
import ScreenRecorderCapture
import ScreenRecorderMedia

/// Compact receipt for a caller-owned derivative. Timing arrays and raw records stay off the wire.
package struct SourceEvidenceExport: Encodable {
    package let normalizationVersion = 2
    package let file: String
    package let journal = "capture.journal.jsonl"
    package let header: CaptureJournalHeader?
    package let originHostUs: Int64?
    package let cursorSamples: Int
    package let geometryRecords: Int
    package let pauseEvents: Int
    package let audioIntervals: Int
    package let openPauseHostUs: Int64?
    package let displaySpaces: Int
    package let firstCursorSourceUs: Int64?
    package let lastCursorSourceUs: Int64?
    package let lastSequence: Int
    package let incompleteTail: Bool
    package let invalidAtSequence: Int?
    package let finished: Bool
    package let lastLifecycle: JournalLifecycle?
    package let completion: JournalCompletion?
    package let publications: [String: CaptureAudioPublication.VerifiedSource]?
    package let bytes: Int

    /// The caller supplies a finalized/recovered source. A missing finished record remains visible
    /// because recovery may retain a trustworthy prefix after the capture process died.
    package static func write(directory: String, output: String, canonical: [String: String]? = nil) async throws -> Self {
        let source = URL(fileURLWithPath: directory).resolvingSymlinksInPath().standardizedFileURL
        let parent = URL(fileURLWithPath: output).standardizedFileURL.deletingLastPathComponent()
            .resolvingSymlinksInPath().standardizedFileURL
        guard source.path != "/", parent.path != source.path,
            !parent.path.hasPrefix(source.path + "/")
        else {
            throw CaptureFailure(
                "INVALID_OUTPUT", "Evidence requires a new file outside the source directory.")
        }
        let journal = source.appendingPathComponent("capture.journal.jsonl")
        var info = stat()
        guard stat(journal.path, &info) == 0 else {
            let operational = [EACCES, EPERM, EIO].contains(errno)
            throw CaptureFailure(operational ? "JOURNAL_UNAVAILABLE" : "INVALID_JOURNAL",
                "Cannot inspect source evidence journal.")
        }
        guard (info.st_mode & S_IFMT) == S_IFREG else {
            throw CaptureFailure("INVALID_JOURNAL", "Evidence requires a regular journal file.")
        }
        guard info.st_size <= 268_435_456 else {
            throw CaptureFailure("EVIDENCE_LIMIT", "Journal exceeds the evidence read budget.")
        }
        let layout = try CaptureJournal.layout(directory: source.path)
        var publications: [String: CaptureAudioPublication.VerifiedSource] = [:]
        var acquired: [JournalAudioSamples] = []
        // Staged imports supply a closed set of immutable descriptor locators. Recording-owned
        // reads resolve only the two fixed canonical members under the journal lease.
        let lease = layout == 2 ? try CaptureJournalLease(directory: source.path) : nil
        if let lease {
            if let canonical, !Set(canonical.keys).isSubset(of: ["narration", "system"]) {
                throw CaptureFailure("INVALID_REQUEST", "Unexpected canonical audio role.")
            }
            for role in ["narration", "system"] {
                let receipt = source.appendingPathComponent("\(role).publication.json")
                let audio = canonical.map { $0[role] } ??
                    (FileManager.default.fileExists(atPath: source.appendingPathComponent("\(role).mov").path)
                        ? source.appendingPathComponent("\(role).mov").path : nil)
                guard audio != nil || FileManager.default.fileExists(atPath: receipt.path) else { continue }
                guard let audio else { throw CaptureFailure("PUBLICATION_FAILED", "Canonical audio is missing.") }
                let verified = try await CaptureAudioPublication.readPublished(
                    lease: lease, role: role, canonical: URL(fileURLWithPath: audio))
                publications[role] = verified.identity
                acquired += verified.audio
            }
        }
        let destination = try NewFile(at: output, assembledAs: "observations.jsonl")
        defer { destination.discard() }
        let descriptor = Darwin.open(
            destination.url.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o666)
        guard descriptor >= 0 else {
            throw CaptureFailure("INVALID_OUTPUT", "Cannot create evidence output.")
        }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        var bytes = 0
        var geometryRecords = 0
        var displaySpaces = 0
        var pauseEvents = 0
        var audioIntervals = 0
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        func emit<T: Encodable>(_ event: String, _ data: T) throws {
            let line = try encoder.encode(EvidenceRecord(event: event, data: data)) + Data([10])
            guard bytes <= 268_435_456 - line.count else {
                throw CaptureFailure("EVIDENCE_LIMIT", "Evidence exceeds the output budget.")
            }
            try handle.write(contentsOf: line)
            bytes += line.count
        }
        let summary = try CaptureJournal.readEvidence(
            directory: source.path, maximumBytes: 268_435_456, retainTiming: false,
            geometry: {
                try emit("geometry", $0)
                geometryRecords += 1
            },
            samples: { for sample in $0 { try emit("cursorSample", sample) } },
            displaySpace: {
                try emit("displaySpace", $0)
                displaySpaces += 1
            },
            pause: {
                try emit("pause", $0)
                pauseEvents += 1
            },
            audioAcquired: {
                try emit("audioAcquired", $0)
                audioIntervals += 1
            }, pcmAppend: layout == 2 ? { _ in } : nil,
            descriptor: lease?.descriptor, layout: layout)
        for interval in acquired {
            try emit("audioAcquired", interval)
            audioIntervals += 1
        }
        try lease?.check()
        guard summary.header != nil else {
            throw CaptureFailure("INVALID_JOURNAL", "Evidence requires a readable journal header.")
        }
        struct Provenance: Encodable {
            let header: CaptureJournalHeader?
            let lastLifecycle: JournalLifecycle?
            let completion: JournalCompletion?
        }
        guard try encoder.encode(Provenance(header: summary.header,
            lastLifecycle: summary.lastLifecycle, completion: summary.completion)).count <= 16_384 else {
            throw CaptureFailure(
                "EVIDENCE_LIMIT", "Journal provenance exceeds the response budget.")
        }
        try handle.close()
        _ = try destination.publish()
        return Self(
            file: output, header: summary.header, originHostUs: summary.originHostUs,
            cursorSamples: summary.cursorSamples, geometryRecords: geometryRecords,
            pauseEvents: pauseEvents, audioIntervals: audioIntervals,
            openPauseHostUs: summary.openPauseHostUs, displaySpaces: displaySpaces,
            firstCursorSourceUs: summary.firstCursorSourceUs,
            lastCursorSourceUs: summary.lastCursorSourceUs, lastSequence: summary.lastSequence,
            incompleteTail: summary.incompleteTail, invalidAtSequence: summary.invalidAtSequence,
            finished: summary.finished, lastLifecycle: summary.lastLifecycle,
            completion: summary.completion, publications: layout == 2 ? publications : nil, bytes: bytes)
    }
}

private struct EvidenceRecord<T: Encodable>: Encodable {
    let event: String
    let data: T
}
