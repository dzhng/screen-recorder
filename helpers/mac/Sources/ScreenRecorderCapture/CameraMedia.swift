@preconcurrency import AVFoundation
import CryptoKit
import Darwin
import Foundation
import ScreenRecorderMedia

package struct CameraFrameMapping: Codable {
    let ordinal: Int
    let start: CaptureRationalTime
    let nominalEnd: CaptureRationalTime
    private enum CodingKeys: String, CodingKey { case ordinal, start; case nominalEnd = "end" }
    // Callback duration supplies provenance and the final endpoint, not inter-picture availability.
    func acquisitionRange(scale: Int32) throws -> CMTimeRange {
        guard start.timescale > 0, nominalEnd.timescale > 0, start.epoch == 0, nominalEnd.epoch == 0,
            start.value >= 0, nominalEnd.time > start.time else { throw CameraMedia.invalid("Invalid rational camera interval.") }
        let first = CMTimeConvertScale(start.time, timescale: scale, method: .roundHalfAwayFromZero)
        let last = CMTimeConvertScale(nominalEnd.time, timescale: scale, method: .roundHalfAwayFromZero)
        guard last > first else { throw CameraMedia.invalid("Camera interval cannot fit its writer timescale.") }
        return CMTimeRange(start: first, end: last)
    }
}

/// Canonical camera publication/replay owner. Raw files and observations stay retained.
package enum CameraMedia {
    package static let mappingFile = "camera.mapping.jsonl"
    package enum Presentation: String, Codable { case nativeBounded = "native-bounded" }
    package struct Receipt: Codable {
        package let presentation: Presentation
        package let raw: CaptureMediaIdentity
        package let observations: CaptureMediaIdentity
        package let closed: CaptureMediaIdentity?
        package let canonical: CaptureMediaIdentity
        package let candidate: String
        package let representedFrames: Int
        package let firstUs: Int64
        package let endUs: Int64
        package let pictureSHA256: String
        package let diagnostics: [String]
        package let support: ExactRange?
        package let pictureTimeScale: Int32?
        package let binding: CameraCaptureBinding?
        package let originHostUs: Int64?
        package let journal: JournalPrefix?
    }
    private struct Row: Decodable {
        let role: CaptureIngressRole
        let disposition: String
        let cameraFrame: CameraFrameMapping?
    }
    package static func invalid(_ message: String) -> CaptureFailure { CaptureFailure("INVALID_CAMERA_MAPPING", message) }
    private static func save<T: Encodable>(_ value: T, to url: URL) throws {
        let file = try NewFile(at: url.path, assembledAs: "receipt.json")
        defer { file.discard() }
        try file.write(JSONEncoder().encode(value)); _ = try file.publish()
    }
    package static func recordClosed(raw: URL, marker: URL) throws {
        try save(CaptureMediaIdentity.read(raw), to: marker)
    }
    package final class Mapping {
        private let input: FileHandle
        private var pending = Data()
        private var eof = false
        private var lines = 0
        private let openedBytes: Int64
        private var readBytes: Int64 = 0
        private(set) var frames = 0
        private(set) var torn = false
        package init(_ url: URL) throws {
            let descriptor = Darwin.open(url.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
            guard descriptor >= 0 else {
                throw CaptureFailure([ENOENT, ENOTDIR, ELOOP].contains(errno) ? "INVALID_CAMERA_MAPPING" : "MEDIA_UNAVAILABLE", "Cannot open camera mapping.")
            }
            var info = stat()
            guard fstat(descriptor, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
                info.st_size >= 0, info.st_size <= 268_435_456 else {
                Darwin.close(descriptor)
                throw invalid("Camera mapping exceeds its regular-file read budget.")
            }
            input = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
            openedBytes = info.st_size
        }
        deinit { try? input.close() }
        package func next() throws -> CameraFrameMapping? {
            while true {
                try Task.checkCancellation()
                if let end = pending.firstIndex(of: 10) {
                    let data = Data(pending[..<end]); pending.removeSubrange(...end)
                    lines += 1
                    guard lines <= 5_000_000, data.count <= 65536 else { throw invalid("Observation bounds exceeded.") }
                    let row: Row
                    do { row = try JSONDecoder().decode(Row.self, from: data) }
                    catch { throw invalid("Malformed camera observation row.") }
                    if row.role == .camera && row.disposition == "accepted" {
                        guard let frame = row.cameraFrame, frame.ordinal == frames else {
                            throw invalid("Accepted camera mapping is missing or out of ordinal order.")
                        }
                        frames += 1
                        return frame
                    } else if row.cameraFrame != nil { throw invalid("Unaccepted picture has a camera mapping.") }
                } else {
                    guard pending.count <= 65536 else { throw invalid("Observation line exceeds bounded size.") }
                    if eof { torn = !pending.isEmpty; return nil }
                    let remaining = openedBytes - readBytes
                    if remaining == 0 {
                        guard (try input.read(upToCount: 1) ?? Data()).isEmpty else { throw invalid("Camera mapping grew beyond its opened byte boundary.") }
                        eof = true
                    } else {
                        let chunk = try input.read(upToCount: Int(min(65536, remaining))) ?? Data()
                        guard !chunk.isEmpty else { throw invalid("Camera mapping shrank before its opened byte boundary.") }
                        readBytes += Int64(chunk.count); pending.append(chunk)
                    }
                }
            }
        }
    }
    private struct Source: Sendable {
        let input: MediaInput
        let track: AVAssetTrack
        let segments: [SourceSegment]
        let scale: Int32
        var asset: AVURLAsset { input.asset }
        init(url: URL) async throws {
            input = try MediaInput(url: url, purpose: .streaming)
            let asset = input.asset
            let videos = try await asset.loadTracks(withMediaType: .video)
            guard videos.count == 1, try await asset.loadTracks(withMediaType: .audio).isEmpty,
                let track = videos.first else { throw invalid("Camera requires one video track and no audio.") }
            self.track = track
            scale = try await track.load(.naturalTimeScale)
            guard scale > 0 else { throw invalid("Camera has no positive native timescale.") }
            segments = SourceSegment.occupied(of: try await track.load(.segments))
        }
    }
    private final class Pictures {
        let source: Source
        var track: AVAssetTrack { source.track }
        var segments: [SourceSegment] { source.segments }
        var scale: Int32 { source.scale }
        let reader: AVAssetReader
        let output: AVAssetReaderTrackOutput
        private(set) var lastEnd = CMTime.invalid
        convenience init(url: URL) async throws { try self.init(source: await Source(url: url)) }
        init(source: Source) throws {
            self.source = source
            reader = try AVAssetReader(asset: source.asset)
            output = AVAssetReaderTrackOutput(track: source.track,
                outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
            reader.add(output)
            guard reader.startReading() else { throw reader.error ?? invalid("Cannot decode camera payload.") }
        }
        func next() throws -> CMSampleBuffer? {
            while let sample = output.copyNextSampleBuffer() {
                try Task.checkCancellation()
                if let end = assetEnd(ofSamplePresentedAt: sample.presentationTimeStamp, in: segments, of: track) {
                    lastEnd = end
                    return sample
                }
            }
            guard reader.status == .completed else { throw reader.error ?? invalid("Camera decoder ended incompletely.") }
            return nil
        }
        deinit { reader.cancelReading() }
    }
    private static func digest(_ sample: CMSampleBuffer, into hash: inout SHA256, scale: Int32) throws {
        guard let pixel = sample.imageBuffer else { throw invalid("Camera picture has no decoded pixels.") }
        CVPixelBufferLockBaseAddress(pixel, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixel, .readOnly) }
        for number in [CMTimeConvertScale(sample.presentationTimeStamp, timescale: scale, method: .roundHalfAwayFromZero).value,
            Int64(CVPixelBufferGetWidth(pixel)), Int64(CVPixelBufferGetHeight(pixel))] {
            var little = number.littleEndian
            withUnsafeBytes(of: &little) { hash.update(bufferPointer: $0) }
        }
        let base = CVPixelBufferGetBaseAddress(pixel)!
        let visibleRowBytes = CVPixelBufferGetWidth(pixel) * 4
        let stride = CVPixelBufferGetBytesPerRow(pixel)
        let height = CVPixelBufferGetHeight(pixel)
        // Padding is not picture data; tightly packed rows can share one hash update.
        if stride == visibleRowBytes {
            hash.update(bufferPointer: UnsafeRawBufferPointer(start: base, count: visibleRowBytes * height))
        } else {
            for row in 0..<height {
                hash.update(bufferPointer: UnsafeRawBufferPointer(start: base.advanced(by: row * stride), count: visibleRowBytes))
            }
        }
    }
    private static func merged(_ ranges: [CMTimeRange]) -> [CMTimeRange] {
        var result: [CMTimeRange] = []
        for range in ranges {
            if let last = result.last, last.end == range.start {
                result[result.count - 1] = CMTimeRange(start: last.start, end: range.end)
            } else { result.append(range) }
        }
        return result
    }
    private static func hex(_ value: SHA256.Digest) -> String { value.map { String(format: "%02x", $0) }.joined() }

    /// The original closed observation bytes become a local immutable publication dependency.
    package static func retainMapping(observations: URL, directory: URL, identity: CaptureMediaIdentity? = nil) throws -> URL {
        let expected = try identity ?? CaptureMediaIdentity.read(observations, maximumBytes: 268_435_456)
        guard expected.bytes > 0, expected.bytes <= 268_435_456 else { throw invalid("Camera mapping exceeds its read budget.") }
        let target = directory.appendingPathComponent(mappingFile)
        if FileManager.default.fileExists(atPath: target.path) {
            guard try CaptureMediaIdentity.read(target, maximumBytes: 268_435_456) == expected else { throw invalid("Retained camera mapping differs from closed observations.") }
            return target
        }
        let descriptor = Darwin.open(observations.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
        guard descriptor >= 0 else { throw CaptureFailure("MEDIA_UNAVAILABLE", "Cannot retain camera mapping input.") }
        let input = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer { try? input.close() }
        let file = try NewFile(at: target.path, assembledAs: "mapping.jsonl")
        defer { file.discard() }
        var bytes: Int64 = 0
        while let data = try input.read(upToCount: 65536), !data.isEmpty {
            try Task.checkCancellation()
            bytes += Int64(data.count)
            guard bytes <= expected.bytes else { throw invalid("Closed camera mapping changed length.") }
            try file.write(data)
        }
        guard try CaptureMediaIdentity.read(file.url, maximumBytes: 268_435_456) == expected,
            try CaptureMediaIdentity.read(observations, maximumBytes: 268_435_456) == expected else { throw invalid("Closed camera mapping changed during retention.") }
        _ = try file.publish()
        return target
    }

    private static func facts(_ lease: CaptureJournalLease, through prefix: JournalPrefix? = nil) throws -> CaptureJournalSummary {
        try lease.check()
        return try CaptureJournal.readEvidence(directory: lease.directory, maximumBytes: 268_435_456, retainTiming: true,
            geometry: { _ in }, samples: { _ in }, displaySpace: { _ in }, retainPrefix: true,
            through: prefix, descriptor: lease.descriptor)
    }

    private static func validateJournal(_ receipt: Receipt, lease: CaptureJournalLease) throws {
        let pinned = try facts(lease, through: receipt.journal)
        guard let header = pinned.header, header.schemaVersion == 1 else { throw invalid("Camera requires its source journal.") }
        let production = header.source.kind == "camera" || header.cameraBinding != nil || receipt.binding != nil
        if production {
            guard let binding = receipt.binding, header.source.kind == "camera", header.cameraBinding == binding,
                header.sessionID == binding.sourceId, !header.microphone, !header.systemAudio,
                receipt.journal != nil, receipt.originHostUs != nil, receipt.support != nil,
                let scale = receipt.pictureTimeScale, scale > 0 else { throw invalid("Production camera requires bound exact publication proof.") }
            try binding.validate()
        }
        if receipt.journal != nil {
            let current = try facts(lease)
            guard receipt.binding == header.cameraBinding, receipt.originHostUs == pinned.originHostUs,
                current.originHostUs == pinned.originHostUs, current.pauses == pinned.pauses,
                current.openPauseHostUs == pinned.openPauseHostUs else { throw invalid("Camera binding or shared clock differs from its publication prefix.") }
        }
        try lease.check()
    }

    private struct CanonicalScan: Sendable {
        let support: ExactRange
        let pictureHash: String
        let remainingMapping: Result<Void, any Error>
        func verified(against expectedHash: String) throws -> ExactRange {
            guard pictureHash == expectedHash else { throw invalid("Canonical camera pixels or terminal support changed.") }
            try remainingMapping.get()
            return support
        }
    }
    /// One ordered-picture, exact-PTS, native-support and visible-BGRA verifier for publication/admission.
    private static func verifyCanonical(_ url: URL, mappingURL: URL, represented: Int, scale: Int32,
        pictureHash: String, expected: ExactRange?) async throws -> ExactRange {
        let scanned = try await scanCanonical(url, mappingURL: mappingURL, represented: represented,
            scale: scale, expected: expected)
        return try scanned.verified(against: pictureHash)
    }
    private static func scanCanonical(_ url: URL, mappingURL: URL, represented: Int, scale: Int32,
        expected: ExactRange?) async throws -> CanonicalScan {
        guard represented > 0, represented <= 5_000_000, scale > 0 else { throw invalid("Invalid represented camera picture count or timescale.") }
        let candidate = try await Pictures(url: url)
        let ranges = merged(candidate.segments.map(\.asset))
        guard ranges.count == 1, let support = ranges.first else { throw invalid("Camera has no single bounded native support interval.") }
        let exact = try ExactRange(startUs: ExactTime(support.start), endUs: ExactTime(support.end))
        guard expected.map({ $0 == exact }) ?? true else { throw invalid("Canonical camera support differs from publication.") }
        let mapping = try Mapping(mappingURL)
        var hash = SHA256()
        var previous: CMTime?
        var last: CMTimeRange?
        for ordinal in 0..<represented {
            guard let frame = try mapping.next() else { throw invalid("Camera mapping ended before represented pictures.") }
            let range = try frame.acquisitionRange(scale: scale)
            guard previous.map({ $0 < frame.start.time }) ?? true,
                ordinal != 0 || support.start == range.start,
                let sample = try candidate.next(), sample.presentationTimeStamp == range.start else { throw invalid("Canonical camera picture order or exact timestamp changed.") }
            previous = frame.start.time; last = range
            try digest(sample, into: &hash, scale: scale)
        }
        guard let last, support.end > last.start, support.end <= last.end,
            try candidate.next() == nil else { throw invalid("Canonical camera pixels or terminal support changed.") }
        let pictureHash = hex(hash.finalize())
        // Hash disagreement precedes malformed trailing mapping rows, as in sequential verification.
        let remaining: Result<Void, any Error>
        do {
            while let frame = try mapping.next() {
                _ = try frame.acquisitionRange(scale: scale)
                guard previous.map({ $0 < frame.start.time }) ?? true else { throw invalid("Camera acquisition timestamps are not strictly increasing.") }
                previous = frame.start.time
            }
            remaining = .success(())
        } catch { remaining = .failure(error) }
        return CanonicalScan(support: exact, pictureHash: pictureHash, remainingMapping: remaining)
    }

    private static func readReceipt(_ url: URL) throws -> (Receipt, CaptureMediaIdentity) {
        let descriptor = Darwin.open(url.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
        guard descriptor >= 0 else { throw CaptureFailure([ENOENT, ENOTDIR, ELOOP].contains(errno) ? "INVALID_CAMERA_MAPPING" : "MEDIA_UNAVAILABLE", "Cannot read camera publication receipt.") }
        let input = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer { try? input.close() }
        let identity = try CaptureMediaIdentity.read(URL(fileURLWithPath: "/dev/fd/\(descriptor)"), maximumBytes: 65536)
        let data = try input.read(upToCount: 65537) ?? Data()
        guard Int64(data.count) == identity.bytes, hex(SHA256.hash(data: data)) == identity.sha256 else { throw invalid("Camera publication receipt changed during read.") }
        do { return (try JSONDecoder().decode(Receipt.self, from: data), identity) }
        catch { throw invalid("Malformed retained camera publication.") }
    }

    package struct VerifiedSource: Encodable, Sendable {
        package let canonical: CaptureMediaIdentity
        package let receipt: CaptureMediaIdentity
        package let mapping: CaptureMediaIdentity
        package let support: ExactRange
        package let representedFrames: Int
    }

    /// Read-only admission verifies the supplied immutable canonical descriptor; it never republishes.
    package static func readPublished(lease: CaptureJournalLease, canonical: URL) async throws -> (identity: VerifiedSource, diagnostics: [String]) {
        let root = URL(fileURLWithPath: lease.directory)
        let receiptURL = root.appendingPathComponent("camera.publication.json")
        let (receipt, receiptIdentity) = try readReceipt(receiptURL)
        try validateJournal(receipt, lease: lease)
        let mappingURL = root.appendingPathComponent(mappingFile)
        let mapping = try CaptureMediaIdentity.read(mappingURL, maximumBytes: 268_435_456)
        guard mapping == receipt.observations, try CaptureMediaIdentity.read(canonical) == receipt.canonical else { throw invalid("Canonical camera or mapping differs from publication.") }
        let scale: Int32
        if let retained = receipt.pictureTimeScale { scale = retained }
        else {
            // Historical unbound receipts did not retain the digest's native scale. Only their actual raw authority can supply it.
            let raw = root.appendingPathComponent("camera.raw.mov")
            let descriptor = Darwin.open(raw.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK)
            guard descriptor >= 0 else { throw CaptureFailure([ENOENT, ENOTDIR, ELOOP].contains(errno) ? "INVALID_CAMERA_MAPPING" : "MEDIA_UNAVAILABLE", "Historical camera proof requires original raw timescale authority.") }
            defer { Darwin.close(descriptor) }
            let original = URL(fileURLWithPath: "/dev/fd/\(descriptor)")
            guard try CaptureMediaIdentity.read(original) == receipt.raw else { throw invalid("Historical raw camera identity differs from publication.") }
            let pictures = try await Pictures(url: original)
            scale = pictures.scale
            guard try CaptureMediaIdentity.read(original) == receipt.raw else { throw invalid("Historical raw camera changed during native scale verification.") }
        }
        let support = try await verifyCanonical(canonical, mappingURL: mappingURL, represented: receipt.representedFrames,
            scale: scale, pictureHash: receipt.pictureSHA256, expected: receipt.support)
        guard try support.startUs.sample(1_000_000, nearest: true) == receipt.firstUs,
            try support.endUs.sample(1_000_000, nearest: true) == receipt.endUs,
            try CaptureMediaIdentity.read(canonical) == receipt.canonical,
            try CaptureMediaIdentity.read(mappingURL, maximumBytes: 268_435_456) == mapping,
            try CaptureMediaIdentity.read(receiptURL, maximumBytes: 65536) == receiptIdentity else { throw invalid("Camera publication changed during canonical verification.") }
        try validateJournal(receipt, lease: lease)
        return (VerifiedSource(canonical: receipt.canonical, receipt: receiptIdentity, mapping: mapping,
            support: support, representedFrames: receipt.representedFrames), receipt.diagnostics)
    }

    private struct IntendedSupport: Sendable {
        let source: Source
        let support: CMTimeRange
        let represented: Int
    }
    /// Metadata qualifies scheduling only; both complete pixel scans still own acceptance.
    private static func intendedSupport(rawURL: URL, mappingURL: URL) async throws -> IntendedSupport? {
        do {
            let source = try await Source(url: rawURL)
            guard source.segments.count == 1 else { return nil }
            let mapping = try Mapping(mappingURL)
            var first: CMTime?
            var previous: CMTime?
            var support: CMTimeRange?
            try visitPresentedSamples(track: source.track, segments: source.segments) { native in
                guard let frame = try mapping.next() else { throw invalid("Native inventory exceeds mapping.") }
                let range = try frame.acquisitionRange(scale: source.scale)
                guard previous.map({ $0 < frame.start.time }) ?? true,
                    range.start == native.start else { throw invalid("Mapping differs from native inventory.") }
                previous = frame.start.time
                first = first ?? range.start
                support = CMTimeRange(start: first!, end: CMTimeMinimum(range.end, native.end))
            }
            guard let support, support.end > support.start, try mapping.next() == nil, !mapping.torn,
                source.segments[0].asset.start <= support.start,
                source.segments[0].asset.end >= support.end else { return nil }
            return IntendedSupport(source: source, support: support, represented: mapping.frames)
        } catch is CancellationError { throw CancellationError() }
        catch { return nil }
    }
    /// Selects acceptance only after both actual scan results settle; failed speculation cannot defeat a raw prefix.
    package static func acceptScans<Raw: Sendable, Canonical: Sendable>(
        raw: Result<Raw, any Error>, canonical: Result<Canonical, any Error>,
        complete: (Raw) -> Bool, verify: (Raw, Canonical) throws -> ExactRange
    ) throws -> (raw: Raw, support: ExactRange?) {
        let scanned = try raw.get()
        guard complete(scanned) else { return (scanned, nil) }
        return (scanned, try verify(scanned, canonical.get()))
    }
    private static func outcome<T: Sendable>(_ work: @Sendable () async throws -> T) async -> Result<T, any Error> {
        do { return .success(try await work()) }
        catch { return .failure(error) }
    }
    private struct RawScan: Sendable {
        let source: Source
        let support: CMTimeRange
        let represented: Int
        let pictureHash: String
        let diagnostics: [String]
    }
    private static func scanRaw(_ rawURL: URL, mappingURL: URL, sealed: Bool) async throws -> RawScan {
        let mapping = try Mapping(mappingURL)
        let raw = try await Pictures(url: rawURL)
        var support: CMTimeRange?; var rawHash = SHA256(); var diagnostics: [String] = []
        var represented = 0
        var previousMappedStart: CMTime?
        if !sealed { diagnostics.append("unsealedRaw") }
        while let frame = try mapping.next() {
            let range = try frame.acquisitionRange(scale: raw.scale)
            guard previousMappedStart.map({ $0 < frame.start.time }) ?? true else { throw invalid("Camera acquisition timestamps are not strictly increasing.") }
            previousMappedStart = frame.start.time
            let sample: CMSampleBuffer?
            do { sample = try raw.next() }
            catch is CancellationError { throw CancellationError() }
            catch { diagnostics.append("rawDecodeInterrupted"); break }
            guard let sample else { diagnostics.append("acceptedBeyondPhysicalEOF"); break }
            guard sample.presentationTimeStamp == range.start else { throw invalid("Raw picture does not match its exact mapped ordinal.") }
            try digest(sample, into: &rawHash, scale: raw.scale)
            represented += 1
            // Native video holds each acquired picture until the next. Only the final
            // physically decoded frame supplies the conservative terminal endpoint.
            support = CMTimeRange(start: support?.start ?? range.start, end: CMTimeMinimum(range.end, raw.lastEnd))
        }
        guard let support else { throw invalid("No physically verified camera prefix.") }
        if represented == mapping.frames {
            do { if try raw.next() != nil { diagnostics.append("unmappedRawTail") } }
            catch is CancellationError { throw CancellationError() }
            catch { diagnostics.append("rawDecodeInterrupted") }
        }
        // Validate the remaining journal even when the physical payload ended early.
        while let frame = try mapping.next() {
            _ = try frame.acquisitionRange(scale: raw.scale)
            guard previousMappedStart.map({ $0 < frame.start.time }) ?? true else { throw invalid("Camera acquisition timestamps are not strictly increasing.") }
            previousMappedStart = frame.start.time
        }
        if mapping.torn { diagnostics.append("tornMappingTail") }
        guard merged(raw.segments.map(\.asset)).contains(where: { $0.start <= support.start && $0.end >= support.end }) else {
            throw invalid("Raw camera presentation does not cover its bounded acquired prefix.")
        }
        let pictureHash = hex(rawHash.finalize())
        return RawScan(source: raw.source, support: support, represented: represented,
            pictureHash: pictureHash, diagnostics: diagnostics)
    }
    private static func exportCandidate(rawURL: URL, canonicalURL: URL,
        source: Source, support: CMTimeRange) async throws -> NewFile {
        let file: NewFile
        do { file = try NewFile(at: canonicalURL.path, assembledAs: "camera.mov") }
        catch {
            if FileManager.default.fileExists(atPath: canonicalURL.path) {
                throw CaptureFailure("PUBLICATION_CONFLICT", "Camera output already exists without a matching receipt; no replacement performed.")
            }
            throw error
        }
        // Keep failed candidates for diagnosis/recovery; raw media and mapping are never removed.
        let composition = AVMutableComposition()
        guard let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw invalid("Cannot construct canonical camera track.") }
        track.naturalTimeScale = source.scale
        track.preferredTransform = try await source.track.load(.preferredTransform)
        var pieces: [AVCompositionTrackSegment] = []
        if support.start > .zero {
            pieces.append(AVCompositionTrackSegment(timeRange: CMTimeRange(start: .zero, end: support.start)))
        }
        pieces.append(AVCompositionTrackSegment(url: rawURL, trackID: source.track.trackID,
            sourceTimeRange: support, targetTimeRange: support))
        try track.validateSegments(pieces); track.segments = pieces
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else { throw invalid("Cannot export camera edit list.") }
        try await export.export(to: file.url, as: .mov)
        try Task.checkCancellation()
        return file
    }
    package static func publish(lease: CaptureJournalLease, observationURL: URL) async throws -> Receipt {
        try Task.checkCancellation(); try lease.check()
        let root = URL(fileURLWithPath: lease.directory)
        let rawURL = root.appendingPathComponent("camera.raw.mov")
        let markerURL = root.appendingPathComponent("camera.closed.json")
        let receiptURL = root.appendingPathComponent("camera.publication.json")
        let canonicalURL = root.appendingPathComponent("video.mov")
        let rawIdentity = try CaptureMediaIdentity.read(rawURL)
        let observationIdentity = try CaptureMediaIdentity.read(observationURL, maximumBytes: 268_435_456)
        let mappingURL = try retainMapping(observations: observationURL, directory: root, identity: observationIdentity)
        let provenance = try facts(lease)
        guard let header = provenance.header, let prefix = provenance.validatedPrefix else { throw invalid("Camera publication requires source journal provenance.") }
        if let binding = header.cameraBinding {
            try binding.validate()
            guard header.source.kind == "camera", header.sessionID == binding.sourceId,
                provenance.originHostUs != nil, !header.microphone, !header.systemAudio else { throw invalid("Camera journal differs from supplied binding or shared origin.") }
        } else if header.source.kind == "camera" { throw invalid("Production camera has no supplied binding.") }
        let closed = FileManager.default.fileExists(atPath: markerURL.path) ? try CaptureMediaIdentity.read(markerURL) : nil
        if closed != nil {
            let markerBytes = try Data(contentsOf: markerURL)
            let pinned: CaptureMediaIdentity
            do { pinned = try JSONDecoder().decode(CaptureMediaIdentity.self, from: markerBytes) }
            catch { throw invalid("Malformed closed camera marker.") }
            guard pinned == rawIdentity else { throw invalid("Closed camera payload changed.") }
        }
        func unchanged() throws {
            try lease.check(); try Task.checkCancellation()
            guard try CaptureMediaIdentity.read(rawURL) == rawIdentity,
                try CaptureMediaIdentity.read(observationURL, maximumBytes: 268_435_456) == observationIdentity,
                try CaptureMediaIdentity.read(mappingURL, maximumBytes: 268_435_456) == observationIdentity,
                (FileManager.default.fileExists(atPath: markerURL.path) ? try CaptureMediaIdentity.read(markerURL) : nil) == closed else { throw invalid("Camera input changed during publication.") }
        }
        if FileManager.default.fileExists(atPath: receiptURL.path) {
            let (receipt, retainedIdentity) = try readReceipt(receiptURL)
            try validateJournal(receipt, lease: lease)
            guard receipt.raw == rawIdentity, receipt.observations == observationIdentity, receipt.closed == closed else {
                throw invalid("Retained camera publication belongs to other input bytes.")
            }
            let parts = receipt.candidate.split(separator: "/", omittingEmptySubsequences: false)
            guard parts.count == 2, parts[0].hasPrefix(".screenrec-output-"), parts[1] == "camera.mov" else {
                throw invalid("Invalid private camera candidate locator.")
            }
            if !FileManager.default.fileExists(atPath: canonicalURL.path) {
                let candidate = root.appendingPathComponent(receipt.candidate)
                guard try CaptureMediaIdentity.read(candidate) == receipt.canonical else { throw invalid("Prepared camera candidate changed.") }
                let verified = try await readPublished(lease: lease, canonical: candidate)
                guard verified.identity.receipt == retainedIdentity else { throw invalid("Retained camera receipt changed during retry.") }
                try unchanged(); _ = try NewFile.publish(staged: candidate, at: canonicalURL.path)
            }
            guard try CaptureMediaIdentity.read(canonicalURL) == receipt.canonical else {
                throw invalid("Published camera identity conflicts; no replacement performed.")
            }
            let verified = try await readPublished(lease: lease, canonical: canonicalURL)
            guard verified.identity.receipt == retainedIdentity else { throw invalid("Retained camera receipt changed during retry.") }
            try unchanged()
            return receipt
        }
        let intended = closed == nil ? nil : try await intendedSupport(rawURL: rawURL, mappingURL: mappingURL)
        let raw: RawScan
        var verifiedCandidate: (file: NewFile, support: ExactRange)?
        if let intended {
            let exported = await outcome {
                try await exportCandidate(rawURL: rawURL, canonicalURL: canonicalURL,
                    source: intended.source, support: intended.support)
            }
            async let rawResult = outcome { try await scanRaw(rawURL, mappingURL: mappingURL, sealed: true) }
            async let canonicalResult = outcome { () async throws -> CanonicalScan in
                let candidate = try exported.get()
                return try await scanCanonical(candidate.url, mappingURL: mappingURL,
                    represented: intended.represented, scale: intended.source.scale,
                    expected: ExactRange(startUs: try ExactTime(intended.support.start), endUs: try ExactTime(intended.support.end)))
            }
            // Join both readers even on cancellation/failure; raw validation selects the public error first.
            let rawOutcome = await rawResult
            let canonicalOutcome = await canonicalResult
            let accepted = try acceptScans(raw: rawOutcome, canonical: canonicalOutcome,
                complete: { $0.represented == intended.represented && $0.support == intended.support
                    && $0.source.scale == intended.source.scale && $0.diagnostics.isEmpty },
                verify: { try $1.verified(against: $0.pictureHash) })
            raw = accepted.raw
            try Task.checkCancellation()
            if let support = accepted.support {
                verifiedCandidate = (try exported.get(), support)
            } else if case .success(let candidate) = exported {
                candidate.discard()
            }
        } else {
            raw = try await scanRaw(rawURL, mappingURL: mappingURL, sealed: closed != nil)
        }
        let file: NewFile
        let exactSupport: ExactRange
        if let verifiedCandidate {
            file = verifiedCandidate.file
            exactSupport = verifiedCandidate.support
        } else {
            file = try await exportCandidate(rawURL: rawURL, canonicalURL: canonicalURL,
                source: raw.source, support: raw.support)
            exactSupport = try await verifyCanonical(file.url, mappingURL: mappingURL,
                represented: raw.represented, scale: raw.source.scale, pictureHash: raw.pictureHash,
                expected: ExactRange(startUs: try ExactTime(raw.support.start), endUs: try ExactTime(raw.support.end)))
        }
        let support = raw.support, represented = raw.represented, pictureHash = raw.pictureHash
        let diagnostics = raw.diagnostics
        try unchanged()
        let receipt = Receipt(presentation: .nativeBounded, raw: rawIdentity, observations: observationIdentity, closed: closed,
            canonical: try CaptureMediaIdentity.read(file.url),
            candidate: file.url.deletingLastPathComponent().lastPathComponent + "/" + file.url.lastPathComponent,
            representedFrames: represented, firstUs: CMTimeConvertScale(support.start, timescale: 1000000, method: .roundHalfAwayFromZero).value,
            endUs: CMTimeConvertScale(support.end, timescale: 1000000, method: .roundHalfAwayFromZero).value,
            pictureSHA256: pictureHash, diagnostics: diagnostics, support: exactSupport, pictureTimeScale: raw.source.scale,
            binding: header.cameraBinding, originHostUs: provenance.originHostUs, journal: prefix)
        try validateJournal(receipt, lease: lease)
        try lease.synchronize()
        try save(receipt, to: receiptURL)
        try unchanged()
        do { _ = try file.publish() }
        catch {
            if FileManager.default.fileExists(atPath: canonicalURL.path) {
                throw CaptureFailure("PUBLICATION_CONFLICT", "Camera output changed before publication; no replacement performed.")
            }
            throw error
        }
        return receipt
    }
}
