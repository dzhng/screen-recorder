import CryptoKit
import Darwin
import Foundation

/// Bounded immutable authority for one source; timing samples remain in its journal and media proofs.
public struct CapturePublishedSource: Codable, Sendable {
    public enum Kind: String, Codable, Sendable { case primary, camera }
    public struct Journal: Codable, Sendable, Equatable {
        public let file: String
        public let bytes: Int64
        public let sha256: String
        public let lastSequence: Int
        public let layout: Int
    }
    public let kind: Kind
    public let sourceId: String
    public let sourceDurationUs: Int64
    public let originHostUs: Int64
    public let binding: CameraCaptureBinding?
    public let diagnostic: CaptureFailure?
    public let journal: Journal
    fileprivate let members: [String: CaptureMediaIdentity]

    /// Recovery consumes the same persisted authority as live publication, independently per source.
    public static func recover(directory: String) async throws -> CapturePublishedSource {
        let lease = try CaptureJournalLease(directory: directory)
        defer { lease.release() }
        let receipt = try CaptureSourcePublication.read(lease: lease)
        try CaptureSourcePublication.verify(receipt, lease: lease)
        try await CaptureSourcePublication.verifyMedia(receipt, lease: lease)
        return receipt
    }
}

public enum CaptureSourcePublicationOutcome: Codable, Sendable {
    case pending(CaptureFinalizationError)
    case published(CapturePublishedSource)
    case unavailable(CaptureFailure)
}

public struct CapturePublicationObservation: Codable, Sendable {
    public let generation: UUID
    public let sourceId: String
    public var inputsClosed: Bool
    public var primary: CaptureSourcePublicationOutcome?
    public var camera: CaptureSourcePublicationOutcome?
}

/// The source receipt adds no publication queue: its caller already owns the capture journal lease.
package enum CaptureSourcePublication {
    private static let receiptFile = "source.publication.json"
    private static let journalLimit = 268_435_456

    package static func publish(kind: CapturePublishedSource.Kind, durationUs: Int64,
        originHostUs: Int64?, tracks: [CapturedTrack], diagnostic: CaptureFailure?,
        lease: CaptureJournalLease, layout: Int) throws -> CapturePublishedSource {
        try lease.synchronize()
        if try lease.hasMember(receiptFile) {
            let receipt = try read(lease: lease)
            guard receipt.kind == kind else { throw invalid("Source publication kind changed.") }
            try verify(receipt, lease: lease)
            return receipt
        }
        let journalFile = kind == .primary ? "source.journal.jsonl" : "capture.journal.jsonl"
        if kind == .primary, try !lease.hasMember(journalFile) {
            let summary = try summary(lease: lease, descriptor: lease.descriptor, layout: layout)
            guard summary.finished, !summary.incompleteTail, summary.invalidAtSequence == nil,
                let prefix = summary.validatedPrefix else { throw invalid("Source completion is not durably recorded.") }
            let sourceDescriptor = lease.descriptor
            try lease.publishMember(journalFile) { output in
                var offset: Int64 = 0
                while offset < prefix.bytes {
                    try Task.checkCancellation()
                    var data = Data(count: Int(min(65536, prefix.bytes - offset)))
                    let count = data.withUnsafeMutableBytes { pread(sourceDescriptor, $0.baseAddress, $0.count, offset) }
                    if count < 0 && errno == EINTR { continue }
                    guard count > 0 else { throw invalid("Closed journal ended before its validated prefix.") }
                    data.count = count
                    try write(data, to: output, offset: offset)
                    offset += Int64(count)
                }
            }
        }
        let descriptor = try lease.openMember(journalFile)
        defer { close(descriptor) }
        let summary = try summary(lease: lease, descriptor: descriptor, layout: layout)
        let identity = try CaptureMediaIdentity.read(URL(fileURLWithPath: "/dev/fd/\(descriptor)"), maximumBytes: Int64(journalLimit))
        guard let prefix = summary.validatedPrefix, prefix.bytes == identity.bytes, prefix.sha256 == identity.sha256,
            let header = summary.header, let origin = summary.originHostUs,
            let completion = summary.completion, completion.durationUs > 0,
            completion.durationUs == durationUs, originHostUs == origin,
            !summary.incompleteTail, summary.invalidAtSequence == nil else {
            throw invalid("Source has no verified positive completion authority.")
        }
        var names = ["video.mov"]
        if kind == .camera { names += ["camera.publication.json", CameraMedia.mappingFile] }
        else {
            for role in ["narration", "system"] where tracks.contains(where: { $0.role == role && $0.file == "\(role).mov" && $0.samples > 0 }) {
                names += ["\(role).mov", "\(role).publication.json"]
            }
        }
        var members: [String: CaptureMediaIdentity] = [:]
        for name in names { members[name] = try memberIdentity(name, lease: lease) }
        let receipt = CapturePublishedSource(kind: kind, sourceId: header.sessionID,
            sourceDurationUs: completion.durationUs, originHostUs: origin, binding: header.cameraBinding,
            diagnostic: diagnostic.map { CaptureFailure(bounded: $0) },
            journal: .init(file: journalFile, bytes: identity.bytes, sha256: identity.sha256,
                lastSequence: summary.lastSequence, layout: layout), members: members)
        try verify(receipt, lease: lease)
        let data = try JSONEncoder().encode(receipt)
        try lease.publishMember(receiptFile) { try write(data, to: $0, offset: 0) }
        return receipt
    }

    fileprivate static func read(lease: CaptureJournalLease) throws -> CapturePublishedSource {
        let descriptor = try lease.openMember(receiptFile)
        defer { close(descriptor) }
        let identity = try CaptureMediaIdentity.read(URL(fileURLWithPath: "/dev/fd/\(descriptor)"), maximumBytes: 65536)
        var data = Data(count: Int(identity.bytes))
        let count = data.withUnsafeMutableBytes { pread(descriptor, $0.baseAddress, $0.count, 0) }
        guard count == data.count, SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == identity.sha256 else {
            throw invalid("Source receipt changed during read.")
        }
        do { return try JSONDecoder().decode(CapturePublishedSource.self, from: data) }
        catch { throw invalid("Source receipt is malformed.") }
    }

    fileprivate static func verify(_ receipt: CapturePublishedSource, lease: CaptureJournalLease) throws {
        try lease.check()
        let expectedJournal = receipt.kind == .primary ? "source.journal.jsonl" : "capture.journal.jsonl"
        let allowedMembers: Set<String> = receipt.kind == .primary
            ? ["video.mov", "narration.mov", "system.mov", "narration.publication.json", "system.publication.json"]
            : ["video.mov", "camera.publication.json", CameraMedia.mappingFile]
        guard receipt.journal.file == expectedJournal, [1, 2].contains(receipt.journal.layout),
            Set(receipt.members.keys).isSubset(of: allowedMembers), receipt.members["video.mov"] != nil,
            receipt.kind != .camera || Set(receipt.members.keys) == allowedMembers else {
            throw invalid("Source receipt names invalid authority members.")
        }
        let descriptor = try lease.openMember(expectedJournal)
        defer { close(descriptor) }
        let identity = try CaptureMediaIdentity.read(URL(fileURLWithPath: "/dev/fd/\(descriptor)"), maximumBytes: Int64(journalLimit))
        guard identity.bytes == receipt.journal.bytes, identity.sha256 == receipt.journal.sha256 else {
            throw invalid("Immutable source journal changed.")
        }
        let summary = try summary(lease: lease, descriptor: descriptor, layout: receipt.journal.layout)
        try receipt.binding?.validate()
        guard !receipt.sourceId.isEmpty, receipt.sourceId.utf16.count <= 256,
            receipt.diagnostic?.code == summary.completion?.failureCode.map({ String($0.prefix(128)) }),
            receipt.diagnostic?.message == summary.completion?.failureMessage,
            summary.validatedPrefix == JournalPrefix(bytes: identity.bytes, sha256: identity.sha256),
            !summary.incompleteTail, summary.invalidAtSequence == nil,
            summary.lastSequence == receipt.journal.lastSequence,
            summary.header?.sessionID == receipt.sourceId, summary.header?.cameraBinding == receipt.binding,
            summary.originHostUs == receipt.originHostUs, receipt.sourceDurationUs > 0,
            summary.completion?.durationUs == receipt.sourceDurationUs else { throw invalid("Source receipt differs from its journal.") }
        if receipt.kind == .primary {
            _ = try CaptureJournal.readEvidence(directory: lease.directory, maximumBytes: journalLimit,
                retainTiming: false, geometry: { _ in }, samples: { _ in }, displaySpace: { _ in },
                through: JournalPrefix(bytes: identity.bytes, sha256: identity.sha256),
                descriptor: lease.descriptor, layout: receipt.journal.layout)
        }
        for (name, expected) in receipt.members {
            guard try memberIdentity(name, lease: lease) == expected else { throw invalid("Published source member changed: \(name).") }
        }
        for role in ["narration", "system"] {
            guard (receipt.members["\(role).mov"] != nil) == (receipt.members["\(role).publication.json"] != nil) else {
                throw invalid("Published audio proof is incomplete.")
            }
        }
        try lease.check()
    }

    // Live callers have just run their publishers. Recovery uses the same read-only proof checks.
    fileprivate static func verifyMedia(_ receipt: CapturePublishedSource, lease: CaptureJournalLease) async throws {
        let root = URL(fileURLWithPath: lease.directory)
        if receipt.kind == .camera {
            _ = try await CameraMedia.readPublished(lease: lease, canonical: root.appendingPathComponent("video.mov"))
        } else {
            for role in ["narration", "system"] where receipt.members["\(role).mov"] != nil {
                _ = try await CaptureAudioPublication.readPublished(lease: lease, role: role, canonical: root.appendingPathComponent("\(role).mov"))
            }
        }
        try lease.check()
    }

    private static func summary(lease: CaptureJournalLease, descriptor: Int32, layout: Int) throws -> CaptureJournalSummary {
        try CaptureJournal.readEvidence(directory: lease.directory, maximumBytes: journalLimit,
            retainTiming: false, geometry: { _ in }, samples: { _ in }, displaySpace: { _ in },
            retainPrefix: true, descriptor: descriptor, layout: layout)
    }
    private static func memberIdentity(_ name: String, lease: CaptureJournalLease) throws -> CaptureMediaIdentity {
        let descriptor = try lease.openMember(name)
        defer { close(descriptor) }
        return try CaptureMediaIdentity.read(URL(fileURLWithPath: "/dev/fd/\(descriptor)"))
    }
    private static func write(_ data: Data, to descriptor: Int32, offset: Int64) throws {
        try data.withUnsafeBytes { bytes in
            var written = 0
            while written < data.count {
                let count = pwrite(descriptor, bytes.baseAddress!.advanced(by: written), data.count - written, offset + Int64(written))
                if count < 0 && errno == EINTR { continue }
                guard count > 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
                written += count
            }
        }
    }
    private static func invalid(_ message: String) -> CaptureFailure { CaptureFailure("INVALID_JOURNAL_PREFIX", message) }
}
