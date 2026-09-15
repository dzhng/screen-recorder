import Darwin
import Foundation

public struct CaptureJournalHeader: Codable, Sendable {
    public let schemaVersion: Int
    public let sessionID: String
    public let source: CaptureSource
    public let width: Int
    public let height: Int
    public let microphone: Bool
    public let systemAudio: Bool
}

public struct CaptureJournalSummary: Codable, Sendable {
    public let file = "capture.journal.jsonl"
    enum CodingKeys: String, CodingKey {
        case file, header, originHostUs, pauses, openPauseHostUs, lastSequence, incompleteTail,
            finished
    }
    public var header: CaptureJournalHeader?
    public var originHostUs: Int64?
    public var pauses: [PauseEvent] = []
    public var acquiredAudio: [String: [MediaInterval]] = [:]
    public var openPauseHostUs: Int64?
    public var lastSequence = 0
    public var incompleteTail = false
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

    public func append<Event: Encodable>(_ event: String, data: Event, durable: Bool = false) throws
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
                    switch event {
                    case "header":
                        let header = try JSONDecoder().decode(
                            CaptureJournalHeader.self, from: encoded)
                        guard sequence == 1, header.schemaVersion == 1 else {
                            throw CaptureFailure("INVALID_JOURNAL", "Invalid journal header.")
                        }
                        summary.header = header
                    case "origin": summary.originHostUs = data["hostUs"] as? Int64
                    case "pauseBegan": summary.openPauseHostUs = data["hostUs"] as? Int64
                    case "pauseEnded":
                        summary.openPauseHostUs = nil
                        if let pause = data["pause"] as? [String: Any] {
                            summary.pauses.append(
                                try JSONDecoder().decode(
                                    PauseEvent.self,
                                    from: JSONSerialization.data(withJSONObject: pause)))
                        }
                    case "audioSamples":
                        let samples = try JSONDecoder().decode(
                            JournalAudioSamples.self, from: encoded)
                        var intervals = summary.acquiredAudio[samples.role, default: []]
                        if let last = intervals.last, samples.startUs <= last.endUs + 1 {
                            intervals[intervals.count - 1] = MediaInterval(
                                startUs: last.startUs, endUs: max(last.endUs, samples.endUs))
                        } else {
                            intervals.append(
                                MediaInterval(startUs: samples.startUs, endUs: samples.endUs))
                        }
                        summary.acquiredAudio[samples.role] = intervals
                    case "finished": summary.finished = true
                    default: break
                    }
                    summary.lastSequence = sequence
                } catch {
                    summary.incompleteTail = true
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

struct JournalPauseEnd: Encodable {
    let hostUs: Int64
    let pause: PauseEvent?
}

struct JournalTrackStart: Encodable {
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
