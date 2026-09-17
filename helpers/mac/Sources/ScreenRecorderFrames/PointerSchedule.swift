@preconcurrency import AVFoundation
import CryptoKit
import Darwin
import Foundation
import ScreenRecorderMedia

public struct PointerScheduleReceipt: Codable, Sendable {
    let version: Int
    let recordingId: String
    let sourceId: String
    let sourceGeneration: String
    let revisionId: String
    let sourceWidth: Int
    let sourceHeight: Int
    let durationUs: Int64
    let spanCount: Int
    let trailPolicy: String
    let scenePolicy: String
    let file: String
    let bytes: Int
    let records: Int
    let events: Int
    let sha256: String
}

/// Pinned attempt-owned JSONL, validated before encoding and re-hashed during consumption.
/// One bounded record and next state are retained; eligibility belongs entirely to core.
final class PointerSchedule {
    struct State: Decodable {
        struct Time: Decodable {
            let value: String
            let timescale: Int32
            func mediaTime() throws -> CMTime {
                guard let value = Int64(value), value >= 0, timescale > 0 else {
                    throw invalid("Invalid exact pointer time.")
                }
                return CMTime(value: value, timescale: timescale)
            }
        }
        let spanIndex: Int
        let at: Time
        let pointer: CursorPoint?
    }
    private let file: FileHandle
    private let receipt: PointerScheduleReceipt
    private let plan: [VideoRenderSpan]
    private let initial: stat
    private var buffer = Data()
    private var offset = 0
    private var bytes = 0
    private var hash = SHA256()
    private var count = 0
    private var previous: State?
    private(set) var next: State?
    private(set) var clock = MovieClock()
    private var pointer: CursorPoint?

    init(_ receipt: PointerScheduleReceipt, plan: [VideoRenderSpan], width: Int, height: Int) throws
    {
        guard receipt.version == 1, receipt.bytes > 0, receipt.records >= plan.count,
            receipt.events >= receipt.records, receipt.spanCount == plan.count,
            receipt.sourceWidth == width, receipt.sourceHeight == height,
            receipt.durationUs == (try PresentationSource.duration(of: plan)),
            receipt.file.hasPrefix("/"), !receipt.file.contains("\0"), receipt.sha256.count == 64
        else { throw invalid("Pointer receipt does not match movie plan.") }
        let fd = open(receipt.file, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)
        guard fd >= 0 else { throw invalid("Cannot open pinned pointer schedule.") }
        let file = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
            info.st_size == receipt.bytes
        else {
            try? file.close()
            throw invalid("Pointer schedule size or file type changed.")
        }
        self.file = file
        self.receipt = receipt
        self.plan = plan
        self.initial = info
        try header()
        while let state = try readState() { try clock.include(state.at.mediaTime()) }
        try finish()
        try file.seek(toOffset: 0)
        buffer.removeAll(keepingCapacity: true)
        offset = 0
        bytes = 0
        hash = SHA256()
        count = 0
        previous = nil
        try header()
        next = try readState()
    }
    deinit { try? file.close() }

    func selection(spanIndex: Int, at: CMTime, end: CMTime) throws -> (CursorPoint?, CMTime) {
        while let state = next, state.spanIndex == spanIndex, try state.at.mediaTime() <= at {
            pointer = state.pointer
            next = try readState()
        }
        let boundary: CMTime
        if let state = next, state.spanIndex == spanIndex {
            boundary = try state.at.mediaTime()
        } else {
            boundary = end
        }
        return (pointer, CMTimeMinimum(end, boundary))
    }

    func finish() throws {
        guard next == nil, count == receipt.records, previous?.spanIndex == plan.count - 1,
            bytes == receipt.bytes,
            hash.finalize().map({ String(format: "%02x", $0) }).joined() == receipt.sha256
        else { throw invalid("Pointer schedule receipt or complete span coverage differs.") }
        var info = stat()
        guard fstat(file.fileDescriptor, &info) == 0, info.st_dev == initial.st_dev,
            info.st_ino == initial.st_ino, info.st_size == initial.st_size,
            info.st_mtimespec.tv_sec == initial.st_mtimespec.tv_sec,
            info.st_mtimespec.tv_nsec == initial.st_mtimespec.tv_nsec,
            info.st_ctimespec.tv_sec == initial.st_ctimespec.tv_sec,
            info.st_ctimespec.tv_nsec == initial.st_ctimespec.tv_nsec
        else { throw invalid("Pinned pointer schedule changed while reading.") }
    }

    private func header() throws {
        guard let data = try line(),
            let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            throw invalid("Missing pointer schedule header.")
        }
        let expected: [String: Any] = [
            "version": receipt.version, "recordingId": receipt.recordingId,
            "sourceId": receipt.sourceId, "sourceGeneration": receipt.sourceGeneration,
            "revisionId": receipt.revisionId, "sourceWidth": receipt.sourceWidth,
            "sourceHeight": receipt.sourceHeight, "durationUs": receipt.durationUs,
            "spanCount": receipt.spanCount, "trailPolicy": receipt.trailPolicy,
            "scenePolicy": receipt.scenePolicy,
        ]
        guard NSDictionary(dictionary: object).isEqual(to: expected) else {
            throw invalid("Pointer schedule header differs from receipt.")
        }
    }

    private func readState() throws -> State? {
        try autoreleasepool {
            guard let data = try line() else { return nil }
            guard count < receipt.records else { throw invalid("Extra pointer state.") }
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                Set(object.keys) == ["spanIndex", "at", "pointer"]
            else { throw invalid("Pointer state requires an explicit pointer or null.") }
            let state = try JSONDecoder().decode(State.self, from: data)
            let at = try state.at.mediaTime()
            guard plan.indices.contains(state.spanIndex) else {
                throw invalid("Invalid pointer span.")
            }
            let span = plan[state.spanIndex]
            let start = time(microseconds: span.source.startUs)
            let end = time(microseconds: span.source.endUs)
            guard at >= start, at < end else {
                throw invalid("Pointer state lies outside its kept span.")
            }
            if let previous, previous.spanIndex == state.spanIndex {
                guard try previous.at.mediaTime() < at else {
                    throw invalid("Pointer states are not strictly ordered.")
                }
            } else {
                guard state.spanIndex == (previous.map { $0.spanIndex + 1 } ?? 0), at == start
                else {
                    throw invalid("Every kept span requires an initial pointer state.")
                }
            }
            if let p = state.pointer {
                guard p.isOnRaster(width: receipt.sourceWidth, height: receipt.sourceHeight),
                    p.atSourceUs >= 0, time(microseconds: p.atSourceUs) <= at
                else { throw invalid("Pointer coordinates or observation time are invalid.") }
            }
            count += 1
            previous = state
            return state
        }
    }

    private func line() throws -> Data? {
        while true {
            if let newline = buffer[offset...].firstIndex(of: 10) {
                let data = buffer.subdata(in: offset..<newline)
                offset = newline + 1
                guard !data.isEmpty, data.count < 65_536 else {
                    throw invalid("Pointer record exceeds its bound.")
                }
                return data
            }
            if offset > 0 {
                buffer.removeSubrange(0..<offset)
                offset = 0
            }
            guard buffer.count < 65_536 else { throw invalid("Pointer record exceeds its bound.") }
            let chunk = try file.read(upToCount: min(16_384, 65_536 - buffer.count)) ?? Data()
            if chunk.isEmpty {
                guard buffer.isEmpty else { throw invalid("Unterminated pointer record.") }
                return nil
            }
            guard chunk.count <= receipt.bytes - bytes else {
                throw invalid("Pointer file exceeds receipt.")
            }
            bytes += chunk.count
            hash.update(data: chunk)
            buffer.append(chunk)
        }
    }
}
private func invalid(_ message: String) -> NativeFailure {
    NativeFailure("INVALID_REQUEST", message)
}
