import Darwin
import Foundation

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
    public var acquiredAudio: [String: [MediaInterval]] = [:]
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
    public func recordOrigin(hostUs: Int64) throws {
        try append("origin", data: JournalHostTime(hostUs: hostUs), durable: true)
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
        sequence += 1
        let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(data))
        let record = try JSONSerialization.data(
            withJSONObject: ["sequence": sequence, "event": event, "data": payload],
            options: [.sortedKeys])
        try handle.write(contentsOf: record + Data([10]))
        if durable { try handle.synchronize() }
    }

    /// Reads terminated records in order until the reader stops or the file ends, and reports
    /// whether the file ended mid-record. Both the summary and the evidence stream read through
    /// this one loop so they cannot disagree about where a journal stops being believable.
    private static func readRecords(
        directory: String, maximumBytes: Int?, _ body: (Data) throws -> Bool
    ) throws -> Bool {
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
                guard try body(line) else { return false }
            }
            guard pending.count <= 1_048_576 else { return true }
        }
        return !pending.isEmpty
    }

    /// Streams a take's placement evidence without retaining it. A take changes geometry as often
    /// as it delivers frames and samples the pointer sixty times a second, so the caller decides
    /// what to keep. The returned summary is the one `inspect` would build from the same pass, so
    /// a consumer learns from that one pass both what the evidence was and where — at
    /// `invalidAtSequence` or an `incompleteTail` — the file stopped being believable. A stream
    /// that stopped early is otherwise indistinguishable from a short take.
    @discardableResult
    public static func streamCursorEvidence(
        directory: String, geometry: (JournalGeometry) throws -> Void = { _ in },
        samples: ([CursorSample]) throws -> Void = { _ in },
        displaySpace: (JournalDisplaySpace) throws -> Void = { _ in }
    ) throws -> CaptureJournalSummary {
        try readCursorEvidence(
            directory: directory, maximumBytes: nil, retainTiming: true,
            geometry: geometry, samples: samples, displaySpace: displaySpace)
    }

    static func readCursorEvidence(
        directory: String, maximumBytes: Int?, retainTiming: Bool,
        geometry: (JournalGeometry) throws -> Void,
        samples: ([CursorSample]) throws -> Void,
        displaySpace: (JournalDisplaySpace) throws -> Void
    ) throws -> CaptureJournalSummary {
        var summary = CaptureJournalSummary()
        summary.incompleteTail = try readRecords(directory: directory, maximumBytes: maximumBytes) {
            line in
            let event: (name: String, data: Data)
            do {
                event = try apply(line, to: &summary, retainTiming: retainTiming)
            } catch {
                summary.invalidAtSequence = summary.lastSequence + 1
                return false
            }
            switch event.name {
            case "geometry":
                try geometry(JSONDecoder().decode(JournalGeometry.self, from: event.data))
            case "cursorSamples":
                try samples(
                    JSONDecoder().decode(JournalCursorSamples.self, from: event.data).samples)
            case "displaySpace":
                try displaySpace(JSONDecoder().decode(JournalDisplaySpace.self, from: event.data))
            default: break
            }
            return true
        }
        return summary
    }

    /// The same read with nothing streamed, for a consumer that only wants the summary.
    public static func inspect(directory: String) throws -> CaptureJournalSummary {
        try streamCursorEvidence(directory: directory)
    }

    /// Folds one record into the summary and hands back the event it was, so a streaming reader
    /// decodes the payload this call already validated instead of re-deriving it.
    private static func apply(
        _ line: Data, to summary: inout CaptureJournalSummary, retainTiming: Bool
    ) throws -> (
        name: String, data: Data
    ) {
        guard
            let record = try JSONSerialization.jsonObject(with: line) as? [String: Any],
            let sequence = record["sequence"] as? Int,
            sequence == summary.lastSequence + 1,
            let event = record["event"] as? String, sequence > 1 || event == "header",
            let data = record["data"] as? [String: Any]
        else {
            throw CaptureFailure("INVALID_JOURNAL", "Invalid journal record.")
        }
        let encoded = try JSONSerialization.data(withJSONObject: data)
        // Decode timing payloads through their written types so malformed fields
        // reject the record instead of silently erasing previously observed timing.
        switch event {
        case "header":
            let header = try JSONDecoder().decode(
                CaptureJournalHeader.self, from: encoded)
            guard sequence == 1, header.schemaVersion == 1 else {
                throw CaptureFailure("INVALID_JOURNAL", "Invalid journal header.")
            }
            summary.header = header
        case "origin":
            summary.originHostUs = try JSONDecoder().decode(
                JournalHostTime.self, from: encoded
            ).hostUs
        case "pauseBegan":
            summary.openPauseHostUs = try JSONDecoder().decode(
                JournalHostTime.self, from: encoded
            ).hostUs
        case "pauseEnded":
            let ended = try JSONDecoder().decode(JournalPauseEnd.self, from: encoded)
            summary.openPauseHostUs = nil
            if retainTiming, let pause = ended.pause { summary.pauses.append(pause) }
        case "audioSamples":
            let samples = try JSONDecoder().decode(
                JournalAudioSamples.self, from: encoded)
            // Mutate through the dictionary to avoid copying every accumulated gap.
            if !retainTiming { break }
            if let last = summary.acquiredAudio[samples.role]?.last,
                samples.startUs <= last.endUs + 1
            {
                let index = summary.acquiredAudio[samples.role, default: []].count - 1
                summary.acquiredAudio[samples.role, default: []][index] = MediaInterval(
                    startUs: last.startUs, endUs: max(last.endUs, samples.endUs))
            } else {
                summary.acquiredAudio[samples.role, default: []].append(
                    MediaInterval(startUs: samples.startUs, endUs: samples.endUs))
            }
        case "geometry":
            let event = try JSONDecoder().decode(JournalGeometry.self, from: encoded)
            summary.geometryEpochs = event.epoch
            summary.lastGeometry = event.geometry
        case "cursorSamples":
            let batch = try JSONDecoder().decode(
                JournalCursorSamples.self, from: encoded)
            summary.cursorSamples += batch.samples.count
            summary.firstCursorSourceUs =
                summary.firstCursorSourceUs ?? batch.samples.first?.sourceUs
            summary.lastCursorSourceUs =
                batch.samples.last?.sourceUs ?? summary.lastCursorSourceUs
        case "displaySpace":
            summary.zeroOriginHeight = try JSONDecoder().decode(
                JournalDisplaySpace.self, from: encoded
            ).zeroOriginHeight
        case "lifecycle":
            summary.lastLifecycle = try JSONDecoder().decode(JournalLifecycle.self, from: encoded)
        case "finished": summary.finished = true
        default: break
        }
        summary.lastSequence = sequence
        return (name: event, data: encoded)
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

struct JournalAudioSamples: Codable {
    let role: String
    let startUs: Int64
    let endUs: Int64
}

/// A geometry change and the raw frame evidence that explains it.
public struct JournalGeometry: Codable, Sendable {
    public let epoch: Int
    public let hostUs: Int64
    /// Absent when the take was paused or had no source zero yet when the frame arrived.
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
