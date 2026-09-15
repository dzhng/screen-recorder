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
        case file, header, originHostUs, pauses, openPauseHostUs, lastSequence, incompleteTail,
            invalidAtSequence, finished
    }
    public var header: CaptureJournalHeader?
    public var originHostUs: Int64?
    public var pauses: [PauseEvent] = []
    public var acquiredAudio: [String: [MediaInterval]] = [:]
    public var openPauseHostUs: Int64?
    public var lastSequence = 0
    /// The final line has no terminator: a crash cut the journal mid-record.
    public var incompleteTail = false
    /// A whole, terminated record would not decode. Records before it stand; nothing after it was
    /// read. Distinct from `incompleteTail` because a crash boundary and a corrupt record mean
    /// different things to a consumer deciding whether the take ended.
    public var invalidAtSequence: Int?
    public var finished = false
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
    public func recordFinished(_ result: CaptureResult) throws {
        try append("finished", data: result, durable: true)
    }

    private func append<Event: Encodable>(_ event: String, data: Event, durable: Bool = false) throws
    {
        sequence += 1
        let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(data))
        let record = try JSONSerialization.data(
            withJSONObject: ["sequence": sequence, "event": event, "data": payload],
            options: [.sortedKeys])
        try handle.write(contentsOf: record + Data([10]))
        if durable { try handle.synchronize() }
    }

    public static func inspect(directory: String) throws -> CaptureJournalSummary {
        let url = URL(fileURLWithPath: directory).appendingPathComponent("capture.journal.jsonl")
        let input = try FileHandle(forReadingFrom: url)
        defer { try? input.close() }
        var pending = Data()
        var summary = CaptureJournalSummary()
        while let chunk = try input.read(upToCount: 16_384), !chunk.isEmpty {
            pending.append(chunk)
            while let end = pending.firstIndex(of: 10) {
                let line = Data(pending[..<end])
                pending.removeSubrange(...end)
                do {
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
                        if let pause = ended.pause { summary.pauses.append(pause) }
                    case "audioSamples":
                        let samples = try JSONDecoder().decode(
                            JournalAudioSamples.self, from: encoded)
                        // Mutate through the dictionary to avoid copying every accumulated gap.
                        if let last = summary.acquiredAudio[samples.role]?.last,
                            samples.startUs <= last.endUs + 1 {
                            let index = summary.acquiredAudio[samples.role, default: []].count - 1
                            summary.acquiredAudio[samples.role, default: []][index] = MediaInterval(
                                startUs: last.startUs, endUs: max(last.endUs, samples.endUs))
                        } else {
                            summary.acquiredAudio[samples.role, default: []].append(
                                MediaInterval(startUs: samples.startUs, endUs: samples.endUs))
                        }
                    case "finished": summary.finished = true
                    default: break
                    }
                    summary.lastSequence = sequence
                } catch {
                    summary.invalidAtSequence = summary.lastSequence + 1
                    return summary
                }
            }
            guard pending.count <= 1_048_576 else {
                summary.incompleteTail = true
                return summary
            }
        }
        summary.incompleteTail = !pending.isEmpty
        return summary
    }
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
