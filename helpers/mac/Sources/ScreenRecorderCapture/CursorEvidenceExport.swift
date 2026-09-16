import Darwin
import Foundation

/// Compact receipt for a caller-owned derivative. Timing arrays and raw records stay off the wire.
public struct CursorEvidenceExport: Encodable {
    public let file: String
    public let journal = "capture.journal.jsonl"
    public let header: CaptureJournalHeader?
    public let originHostUs: Int64?
    public let cursorSamples: Int
    public let geometryRecords: Int
    public let displaySpaces: Int
    public let firstCursorSourceUs: Int64?
    public let lastCursorSourceUs: Int64?
    public let lastSequence: Int
    public let incompleteTail: Bool
    public let invalidAtSequence: Int?
    public let finished: Bool
    public let bytes: Int

    /// The caller supplies a finalized/recovered source. A missing finished record remains visible
    /// because recovery may retain a trustworthy prefix after the capture process died.
    public static func write(directory: String, output: String) throws -> Self {
        let source = URL(fileURLWithPath: directory).resolvingSymlinksInPath().standardizedFileURL
        let target = URL(fileURLWithPath: output).standardizedFileURL
        let parent = target.deletingLastPathComponent().resolvingSymlinksInPath()
            .standardizedFileURL
        let destination = parent.appendingPathComponent(target.lastPathComponent)
        var info = stat()
        guard source.path != "/", parent.path != source.path,
            !parent.path.hasPrefix(source.path + "/"),
            lstat(destination.path, &info) != 0, errno == ENOENT
        else {
            throw CaptureFailure(
                "INVALID_OUTPUT", "Evidence requires a new file outside the source directory.")
        }
        let journal = source.appendingPathComponent("capture.journal.jsonl")
        guard stat(journal.path, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG else {
            throw CaptureFailure("INVALID_JOURNAL", "Evidence requires a regular journal file.")
        }
        guard info.st_size <= 268_435_456 else {
            throw CaptureFailure("EVIDENCE_LIMIT", "Journal exceeds the evidence read budget.")
        }
        // Exclusive creation and no-replace publication also reject symlinks/hardlinks and races
        // with another producer. Existing audio/frame helpers intentionally replace derivatives.
        let staging = parent.appendingPathComponent(".cursor-evidence-\(UUID().uuidString)")
        let descriptor = Darwin.open(
            staging.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else {
            throw CaptureFailure("INVALID_OUTPUT", "Cannot create evidence output.")
        }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer {
            try? handle.close()
            try? FileManager.default.removeItem(at: staging)
        }
        var bytes = 0
        var geometryRecords = 0
        var displaySpaces = 0
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
        let summary = try CaptureJournal.readCursorEvidence(
            directory: source.path, maximumBytes: 268_435_456, retainTiming: false,
            geometry: {
                try emit("geometry", $0)
                geometryRecords += 1
            },
            samples: { for sample in $0 { try emit("cursorSample", sample) } },
            displaySpace: {
                try emit("displaySpace", $0)
                displaySpaces += 1
            })
        guard summary.header != nil else {
            throw CaptureFailure("INVALID_JOURNAL", "Evidence requires a readable journal header.")
        }
        guard try encoder.encode(summary.header).count <= 16_384 else {
            throw CaptureFailure(
                "EVIDENCE_LIMIT", "Journal provenance exceeds the response budget.")
        }
        try handle.synchronize()
        // link publishes the complete inode atomically and never replaces an existing name.
        guard Darwin.link(staging.path, destination.path) == 0 else {
            throw CaptureFailure("INVALID_OUTPUT", "Cannot publish evidence to a new output file.")
        }
        return Self(
            file: destination.path, header: summary.header, originHostUs: summary.originHostUs,
            cursorSamples: summary.cursorSamples, geometryRecords: geometryRecords,
            displaySpaces: displaySpaces, firstCursorSourceUs: summary.firstCursorSourceUs,
            lastCursorSourceUs: summary.lastCursorSourceUs, lastSequence: summary.lastSequence,
            incompleteTail: summary.incompleteTail, invalidAtSequence: summary.invalidAtSequence,
            finished: summary.finished, bytes: bytes)
    }
}

private struct EvidenceRecord<T: Encodable>: Encodable {
    let event: String
    let data: T
}
