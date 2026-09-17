@preconcurrency import AVFoundation
import CoreImage
import Darwin
import Foundation
import ScreenRecorderMedia

public struct PresentationEvidenceReceipt: Encodable, Sendable {
    public let file: String
    public let version: Int
    public let sourceWidth: Int
    public let sourceHeight: Int
    public let durationUs: Int64
    public let records: Int
    public let bytes: Int
}

/// Exact timestamps survive transport without JSON's floating-point integer limit.
/// Support endpoints are not rounded to microseconds: membership is half-open in CMTime.
private struct PresentationTime: Encodable {
    let value: String
    let timescale: Int32
    init(_ time: CMTime) {
        value = String(time.value)
        timescale = time.timescale
    }
}
private struct PresentationHeader: Encodable {
    let version = 1
    let sourceWidth: Int
    let sourceHeight: Int
    let durationUs: Int64
    let spanCount: Int
}
private struct PresentationRecord: Encodable {
    let spanIndex: Int
    let start: PresentationTime
    let end: PresentationTime
    let empty: Bool
    let sampleTime: PresentationTime?
    let actualSourceUs: Int64?
    let width: Int?
    let height: Int?
    let rgbBase64: String?
}

/// One sequential decode, one bounded JSONL record at a time. Only the final receipt
/// crosses the worker pipe. Consumers can index/read the stream without loading it whole.
public enum PresentationEvidence {
    public static func write(
        source: URL, plan: [VideoRenderSpan], output: URL, maxBytes: Int
    ) async throws -> PresentationEvidenceReceipt {
        let duration = try PresentationSource.duration(of: plan)
        guard maxBytes > 0, maxBytes <= 9_007_199_254_740_991 else {
            throw NativeFailure("INVALID_REQUEST", "Evidence requires a positive safe byte budget.")
        }
        var info = stat()
        guard source.path.hasPrefix("/"), output.path.hasPrefix("/"),
            source.resolvingSymlinksInPath().standardizedFileURL
                != output.resolvingSymlinksInPath().standardizedFileURL,
            lstat(output.path, &info) != 0, errno == ENOENT
        else {
            throw NativeFailure("INVALID_OUTPUT", "Evidence output must be a new absolute path.")
        }
        try Task.checkCancellation()
        let presentation = try await PresentationSource(source: source, plan: plan)
        let staging = output.deletingLastPathComponent()
            .appendingPathComponent(".presentation-evidence-\(UUID().uuidString)")
        guard mkdir(staging.path, 0o700) == 0 else {
            throw NativeFailure("INVALID_OUTPUT", "Cannot create owned evidence staging directory.")
        }
        defer { try? FileManager.default.removeItem(at: staging) }
        let member = staging.appendingPathComponent("evidence.jsonl")
        let fd = open(member.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        guard fd >= 0 else {
            throw NativeFailure("INVALID_OUTPUT", "Cannot open evidence staging file.")
        }
        let file = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        defer { try? file.close() }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var bytes = 0
        func append(_ record: some Encodable) throws {
            try Task.checkCancellation()
            var data = try encoder.encode(record)
            data.append(10)
            guard data.count <= 65_536, data.count <= maxBytes - bytes else {
                throw NativeFailure(
                    "LIMIT_EXCEEDED", "Presentation evidence exceeds its byte budget.")
            }
            try file.write(contentsOf: data)
            bytes += data.count
        }
        try append(
            PresentationHeader(
                sourceWidth: presentation.width, sourceHeight: presentation.height,
                durationUs: duration, spanCount: plan.count))
        let context = CIContext(options: [.cacheIntermediates: false])
        var count = 0
        for (spanIndex, span) in plan.enumerated() {
            var at = time(microseconds: span.source.startUs)
            let end = time(microseconds: span.source.endUs)
            while at < end {
                let next = try autoreleasepool {
                    let selected = try presentation.selection(at: at, end: end)
                    guard selected.end > at else {
                        throw NativeFailure("UNAVAILABLE", "Presentation evidence made no progress.")
                    }
                    let image = try selected.buffer.map {
                        try FrameImage(
                            buffer: $0, transform: presentation.transform, overlay: nil,
                            agedFromUs: 0, crop: nil, maxLongEdge: 64)
                    }
                    try append(
                        PresentationRecord(
                            spanIndex: spanIndex, start: PresentationTime(at),
                            end: PresentationTime(selected.end), empty: selected.buffer == nil,
                            sampleTime: selected.sampleTime.map(PresentationTime.init),
                            actualSourceUs: selected.sampleTime.map(microseconds),
                            width: image?.width, height: image?.height,
                            rgbBase64: image?.rgb(context: context).base64EncodedString()))
                    return selected.end
                }
                at = next
                count += 1
                // Yield without retaining prior rasters; in-process cancellation can progress too.
                if count.isMultiple(of: 64) { await Task.yield() }
            }
        }
        try file.synchronize()
        try Task.checkCancellation()
        guard link(member.path, output.path) == 0 else {
            throw NativeFailure(
                "INVALID_OUTPUT", "Cannot publish evidence to an occupied destination.")
        }
        return PresentationEvidenceReceipt(
            file: output.path, version: 1, sourceWidth: presentation.width,
            sourceHeight: presentation.height, durationUs: duration, records: count, bytes: bytes)
    }
}
