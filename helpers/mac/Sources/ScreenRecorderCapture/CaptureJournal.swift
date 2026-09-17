import Darwin
import Foundation
import ScreenRecorderMedia

public struct CaptureJournalHeader: Codable, Sendable {
    public init(
        schemaVersion: Int, sessionID: String, source: CaptureSource, width: Int, height: Int,
        microphone: Bool, systemAudio: Bool
    ) {
        self.schemaVersion = schemaVersion
        self.sessionID = sessionID
        self.source = source
        self.width = width
        self.height = height
        self.microphone = microphone
        self.systemAudio = systemAudio
    }

    public let schemaVersion: Int
    public let sessionID: String
    public let source: CaptureSource
    public let width: Int
    public let height: Int
    public let microphone: Bool
    public let systemAudio: Bool

    /// Whether the take asked for this role at all. A take always records video; audio roles are
    /// requested per take, and a role the header never asked for cannot have been lost.
    public func requested(_ role: String) -> Bool {
        switch role {
        case "narration": return microphone
        case "system": return systemAudio
        default: return true
        }
    }
}

public struct CaptureJournalSummary: Codable, Sendable {
    public let file = "capture.journal.jsonl"
    enum CodingKeys: String, CodingKey {
        case file, header, originHostUs, pauses, openPauseHostUs, lastLifecycle, lastSequence,
            incompleteTail,
            invalidAtSequence, finished, cursorSamples, firstCursorSourceUs, lastCursorSourceUs,
            geometryEpochs, lastGeometry, zeroOriginHeight
    }
    public var header: CaptureJournalHeader?
    public var originHostUs: Int64?
    public var pauses: [PauseEvent] = []
    public var acquiredAudio: [String: [TimeSpan]] = [:]
    public var openPauseHostUs: Int64?
    /// Cursor evidence stays a count and a range here. A consumer that needs the samples
    /// themselves streams the journal file; a summary never grows with recording length.
    public var cursorSamples = 0
    public var firstCursorSourceUs: Int64?
    public var lastCursorSourceUs: Int64?
    public var geometryEpochs = 0
    public var lastGeometry: CaptureGeometry?
    /// The zero-origin display height the take last converted its pointer readings through, so a
    /// consumer checks the transform against the height this recording used rather than the one
    /// the display arrangement happens to have now.
    public var zeroOriginHeight: Double?
    /// The transition this take last reported to its service, and the journal sequence that
    /// reported it. A journal read after a crash shows what native last claimed, in the same
    /// numbering the live reports used.
    public var lastLifecycle: JournalLifecycle?
    public var lastSequence = 0
    /// The final line has no terminator: a crash cut the journal mid-record.
    public var incompleteTail = false
    /// A whole, terminated record would not decode. Records before it stand; nothing after it was
    /// read. Distinct from `incompleteTail` because a crash boundary and a corrupt record mean
    /// different things to a consumer deciding whether the take ended.
    public var invalidAtSequence: Int?
    public var finished = false

    public init() {}
}

// One capture queue owns append order. Media bytes never enter this journal.
public final class CaptureJournal {
    private static let maximumRecordBytes = 1_048_576
    private let handle: FileHandle
    private var sequence = 0

    public init(directory: String, header: CaptureJournalHeader) throws {
        let path = URL(fileURLWithPath: directory).appendingPathComponent("capture.journal.jsonl")
            .path
        let descriptor = Darwin.open(path, O_WRONLY | O_CREAT | O_EXCL, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
        handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        try append("header", data: header, durable: true)
    }

    // Each event's name, payload type and durability live here so the writer and `inspect` cannot
    // drift apart. Boundaries a recovery reads to place the take in time are synchronized when
    // written; per-buffer acquisition ranges use ordinary writes. Power-loss durability is unproven.
    public func recordOrigin(hostUs: Int64, placedPauses: [PauseEvent] = []) throws {
        try append("origin", data: JournalHostTime(hostUs: hostUs), durable: true)
        // A placement is not another resume: a later pause may still be open when a delayed
        // frame supplies source zero. Each bounded record leaves that raw control state intact.
        for pause in placedPauses { try append("pausePlaced", data: pause, durable: true) }
    }
    public func recordPauseBegan(hostUs: Int64) throws {
        try append("pauseBegan", data: JournalHostTime(hostUs: hostUs), durable: true)
    }
    public func recordPauseEnded(hostUs: Int64, pause: PauseEvent?) throws {
        try append("pauseEnded", data: JournalPauseEnd(hostUs: hostUs, pause: pause), durable: true)
    }
    public func recordTrackStarted(
        role: String, file: String, firstSourceUs: Int64, sampleRate: Double?,
        channelCount: UInt32?
    ) throws {
        try append(
            "trackStarted",
            data: JournalTrackStart(
                role: role, file: file, firstSourceUs: firstSourceUs, sampleRate: sampleRate,
                channelCount: channelCount), durable: true)
    }
    public func recordAudioSamples(role: String, startUs: Int64, endUs: Int64) throws {
        try append(
            "audioSamples", data: JournalAudioSamples(role: role, startUs: startUs, endUs: endUs))
    }
    /// Geometry epochs and cursor samples are ordinary writes, like per-buffer acquisition ranges:
    /// they are contemporaneous evidence rather than a boundary a recovery needs to place the take
    /// in time. Their file order still guarantees an epoch is written before the samples citing it.
    public func recordGeometry(
        epoch: Int, hostUs: Int64, sourceUs: Int64?, geometry: CaptureGeometry
    ) throws {
        try append(
            "geometry",
            data: JournalGeometry(
                epoch: epoch, hostUs: hostUs, sourceUs: sourceUs, geometry: geometry))
    }
    public func recordCursorSamples(_ samples: [CursorSample]) throws {
        guard !samples.isEmpty else { return }
        try append("cursorSamples", data: JournalCursorSamples(samples: samples))
    }
    public func recordDisplaySpace(hostUs: Int64, zeroOriginHeight: Double) throws {
        try append(
            "displaySpace",
            data: JournalDisplaySpace(hostUs: hostUs, zeroOriginHeight: zeroOriginHeight))
    }
    /// Records one device transition this take reports to its service and hands back the journal
    /// sequence that carries it. The journal is the single producer of these numbers, so a live
    /// report and the same take read back from disk cannot disagree about their order.
    public func recordLifecycle(state: String, reason: String?) throws -> Int {
        try append("lifecycle", data: JournalLifecycle(state: state, reason: reason), durable: true)
        return sequence
    }
    public func recordFinished(_ result: CaptureResult) throws {
        try append("finished", data: result, durable: true)
    }

    private func append<Event: Encodable>(_ event: String, data: Event, durable: Bool = false)
        throws
    {
        // The number is taken only once the record is in the file: a record that could not be
        // encoded or written must not leave a gap the reader would treat as corruption.
        let next = sequence + 1
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let record = try encoder.encode(JournalRecord(sequence: next, event: event, data: data))
        // The reader treats any longer run as corruption, which is only sound if no record is.
        guard record.count < Self.maximumRecordBytes else {
            throw CaptureFailure("JOURNAL_FAILED", "Journal record exceeds its size bound.")
        }
        try handle.write(contentsOf: record + Data([10]))
        sequence = next
        if durable { try handle.synchronize() }
    }

    /// How a pass over the journal's records ended.
    private enum RecordsEnd {
        /// Every byte was read or the reader asked to stop.
        case read
        /// The final line has no terminator: a crash boundary.
        case tornTail
        /// An unterminated run longer than any record the writer produces.
        case oversized
    }

    /// Reads terminated records in order until the reader stops or the file ends. Both the summary
    /// and the evidence stream read through this one loop so they cannot disagree about where a
    /// journal stops being believable.
    private static func readRecords(
        directory: String, maximumBytes: Int?, _ body: (Data) throws -> Bool
    ) throws -> RecordsEnd {
        let url = URL(fileURLWithPath: directory).appendingPathComponent("capture.journal.jsonl")
        let input = try FileHandle(forReadingFrom: url)
        defer { try? input.close() }
        var pending = Data()
        var bytes = 0
        while let chunk = try input.read(upToCount: 16_384), !chunk.isEmpty {
            bytes += chunk.count
            if let maximumBytes, bytes > maximumBytes {
                throw CaptureFailure("EVIDENCE_LIMIT", "Journal exceeds the evidence read budget.")
            }
            pending.append(chunk)
            while let end = pending.firstIndex(of: 10) {
                let line = Data(pending[..<end])
                pending.removeSubrange(...end)
                // Foundation JSON bridging creates autoreleased objects. Drain each record so
                // a long worker request does not retain the entire parsed journal indirectly.
                guard try autoreleasepool(invoking: { try body(line) }) else { return .read }
            }
            // The writer never produces a record this long, so an unterminated run past the bound
            // is corruption wherever it sits, never a crash that cut a record short.
            guard pending.count <= maximumRecordBytes else { return .oversized }
        }
        return pending.isEmpty ? .read : .tornTail
    }

    /// Streams a take's placement evidence without retaining it. A take changes geometry as often
    /// as it delivers frames and samples the pointer sixty times a second, so the caller decides
    /// what to keep. The returned summary omits pause/audio arrays (those are streamed), so
    /// a consumer learns from that one pass both what the evidence was and where — at
    /// `invalidAtSequence` or an `incompleteTail` — the file stopped being believable. A stream
    /// that stopped early is otherwise indistinguishable from a short take.
    @discardableResult
    public static func streamEvidence(
        directory: String, geometry: (JournalGeometry) throws -> Void = { _ in },
        samples: ([CursorSample]) throws -> Void = { _ in },
        displaySpace: (JournalDisplaySpace) throws -> Void = { _ in },
        pause: (PauseEvent) throws -> Void = { _ in },
        audioAcquired: (JournalAudioSamples) throws -> Void = { _ in }
    ) throws -> CaptureJournalSummary {
        try readEvidence(
            directory: directory, maximumBytes: nil, retainTiming: false,
            geometry: geometry, samples: samples, displaySpace: displaySpace,
            pause: pause, audioAcquired: audioAcquired)
    }

    static func readEvidence(
        directory: String, maximumBytes: Int?, retainTiming: Bool,
        geometry: (JournalGeometry) throws -> Void,
        samples: ([CursorSample]) throws -> Void,
        displaySpace: (JournalDisplaySpace) throws -> Void,
        pause: (PauseEvent) throws -> Void = { _ in },
        audioAcquired: (JournalAudioSamples) throws -> Void = { _ in }
    ) throws -> CaptureJournalSummary {
        var summary = CaptureJournalSummary()
        // At most one pending interval per supported role; the stream never accumulates gaps.
        var pendingAudio: [String: JournalAudioSamples] = [:]
        func emitAudio(_ interval: JournalAudioSamples) throws {
            if retainTiming {
                summary.acquiredAudio[interval.role, default: []].append(
                    TimeSpan(startUs: interval.startUs, endUs: interval.endUs))
            }
            try audioAcquired(interval)
        }
        func emitPause(_ completed: PauseEvent) throws {
            if retainTiming { summary.pauses.append(completed) }
            try pause(completed)
        }
        let end = try readRecords(directory: directory, maximumBytes: maximumBytes) {
            line in
            let record: JournalEntry
            do {
                record = try JSONDecoder().decode(JournalEntry.self, from: line)
                try record.check(following: summary.lastSequence)
            } catch {
                summary.invalidAtSequence = summary.lastSequence + 1
                return false
            }
            summary.lastSequence = record.sequence
            switch record.event {
            case .header(let header): summary.header = header
            case .origin(let hostUs): summary.originHostUs = hostUs
            case .pauseBegan(let hostUs): summary.openPauseHostUs = hostUs
            case .pauseEnded(let completed):
                summary.openPauseHostUs = nil
                if let completed { try emitPause(completed) }
            case .pausePlaced(let placed): try emitPause(placed)
            case .audioSamples(let next):
                if let previous = pendingAudio[next.role] {
                    // Acquisition timestamps are monotonic per role.
                    let span = TimeSpan(startUs: previous.startUs, endUs: previous.endUs)
                    let arriving = TimeSpan(startUs: next.startUs, endUs: next.endUs)
                    if span.isContinued(by: arriving) {
                        let merged = span.merged(with: arriving)
                        pendingAudio[next.role] = JournalAudioSamples(
                            role: next.role, startUs: merged.startUs, endUs: merged.endUs)
                    } else {
                        try emitAudio(previous)
                        pendingAudio[next.role] = next
                    }
                } else {
                    pendingAudio[next.role] = next
                }
            case .geometry(let observed):
                summary.geometryEpochs = observed.epoch
                summary.lastGeometry = observed.geometry
                try geometry(observed)
            case .cursorSamples(let batch):
                summary.cursorSamples += batch.count
                summary.firstCursorSourceUs = summary.firstCursorSourceUs ?? batch.first?.sourceUs
                summary.lastCursorSourceUs = batch.last?.sourceUs ?? summary.lastCursorSourceUs
                try samples(batch)
            case .displaySpace(let space):
                summary.zeroOriginHeight = space.zeroOriginHeight
                try displaySpace(space)
            case .lifecycle(let lifecycle): summary.lastLifecycle = lifecycle
            case .finished: summary.finished = true
            case .other: break
            }
            return true
        }
        switch end {
        case .read: break
        case .tornTail: summary.incompleteTail = true
        case .oversized: summary.invalidAtSequence = summary.lastSequence + 1
        }
        for role in ["narration", "system"] {
            if let interval = pendingAudio[role] { try emitAudio(interval) }
        }
        return summary
    }

    /// The same read with nothing streamed, for a consumer that only wants the summary.
    public static func inspect(directory: String) throws -> CaptureJournalSummary {
        try readEvidence(
            directory: directory, maximumBytes: nil, retainTiming: true,
            geometry: { _ in }, samples: { _ in }, displaySpace: { _ in })
    }
}

private struct JournalRecord<Event: Encodable>: Encodable {
    let sequence: Int
    let event: String
    let data: Event
}

/// One journal line, decoded once through the payload type its event name declares. A payload
/// that will not decode through that type rejects the whole record rather than leaving a boundary
/// silently empty.
private struct JournalEntry: Decodable {
    enum Event {
        case header(CaptureJournalHeader)
        case origin(Int64)
        case pauseBegan(Int64)
        case pauseEnded(PauseEvent?)
        case pausePlaced(PauseEvent)
        case audioSamples(JournalAudioSamples)
        case geometry(JournalGeometry)
        case cursorSamples([CursorSample])
        case displaySpace(JournalDisplaySpace)
        case lifecycle(JournalLifecycle)
        case finished
        case other
    }

    private enum CodingKeys: String, CodingKey { case sequence, event, data }
    private struct AnyKey: CodingKey {
        let stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { nil }
    }

    let sequence: Int
    let name: String
    let event: Event

    init(from decoder: Decoder) throws {
        let record = try decoder.container(keyedBy: CodingKeys.self)
        sequence = try record.decode(Int.self, forKey: .sequence)
        name = try record.decode(String.self, forKey: .event)
        // Every event carries an object payload, including events this reader does not interpret.
        _ = try record.nestedContainer(keyedBy: AnyKey.self, forKey: .data)
        func payload<T: Decodable>(_ type: T.Type) throws -> T {
            try record.decode(type, forKey: .data)
        }
        func invalid(_ message: String) -> CaptureFailure {
            CaptureFailure("INVALID_JOURNAL", message)
        }
        switch name {
        case "header":
            let header = try payload(CaptureJournalHeader.self)
            guard header.schemaVersion == 1 else { throw invalid("Invalid journal header.") }
            event = .header(header)
        case "origin": event = .origin(try payload(JournalHostTime.self).hostUs)
        case "pauseBegan": event = .pauseBegan(try payload(JournalHostTime.self).hostUs)
        case "pauseEnded":
            let ended = try payload(JournalPauseEnd.self)
            if let pause = ended.pause, pause.atSourceUs < 0 || pause.elapsedPauseUs < 0 {
                throw invalid("Invalid pause interval.")
            }
            event = .pauseEnded(ended.pause)
        case "pausePlaced":
            let pause = try payload(PauseEvent.self)
            guard pause.atSourceUs >= 0, pause.elapsedPauseUs >= 0 else {
                throw invalid("Invalid pause interval.")
            }
            event = .pausePlaced(pause)
        case "audioSamples":
            let samples = try payload(JournalAudioSamples.self)
            guard ["narration", "system"].contains(samples.role),
                samples.startUs >= 0, samples.endUs > samples.startUs
            else { throw invalid("Invalid audio acquisition interval.") }
            event = .audioSamples(samples)
        case "geometry": event = .geometry(try payload(JournalGeometry.self))
        case "cursorSamples": event = .cursorSamples(try payload(JournalCursorSamples.self).samples)
        case "displaySpace": event = .displaySpace(try payload(JournalDisplaySpace.self))
        case "lifecycle": event = .lifecycle(try payload(JournalLifecycle.self))
        case "finished": event = .finished
        default: event = .other
        }
    }

    /// Records are numbered from one without gaps, and only the first is the header.
    func check(following lastSequence: Int) throws {
        guard sequence == lastSequence + 1, (sequence == 1) == (name == "header") else {
            throw CaptureFailure("INVALID_JOURNAL", "Invalid journal record.")
        }
    }
}

/// A device transition as native reported it.
public struct JournalLifecycle: Codable, Sendable {
    public let state: String
    public let reason: String?
}

struct JournalHostTime: Codable {
    let hostUs: Int64
}

struct JournalPauseEnd: Codable {
    let hostUs: Int64
    let pause: PauseEvent?
}

struct JournalTrackStart: Codable {
    let role: String
    let file: String
    let firstSourceUs: Int64
    let sampleRate: Double?
    let channelCount: UInt32?
}

public struct JournalAudioSamples: Codable, Sendable {
    public let role: String
    public let startUs: Int64
    public let endUs: Int64
}

/// A geometry observation and the raw frame evidence that explains it. An epoch can occur
/// twice: first without source time, then confirmed on a usable frame in source time.
public struct JournalGeometry: Codable, Sendable {
    public let epoch: Int
    public let hostUs: Int64
    /// Absent when the clock could not place the observed frame (before source zero or across a pause).
    public let sourceUs: Int64?
    public let geometry: CaptureGeometry
}

struct JournalCursorSamples: Codable {
    let samples: [CursorSample]
}

/// The zero-origin display height a take converted its pointer readings through, and when it
/// started doing so. Written whenever the height changes, so the conversion is re-derivable from
/// the journal instead of from whatever the display arrangement is when the evidence is read.
public struct JournalDisplaySpace: Codable, Sendable {
    public let hostUs: Int64
    public let zeroOriginHeight: Double
}
