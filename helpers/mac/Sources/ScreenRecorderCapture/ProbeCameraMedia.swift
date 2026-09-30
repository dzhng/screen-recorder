@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderMedia

package struct ProbeCameraFrame: Codable {
    let ordinal: Int
    let start: ProbeTime
    let nominalEnd: ProbeTime
    private enum CodingKeys: String, CodingKey { case ordinal, start; case nominalEnd = "end" }
    // Callback duration supplies provenance and the final endpoint, not inter-picture availability.
    func acquisitionRange(scale: Int32) throws -> CMTimeRange {
        guard start.timescale > 0, nominalEnd.timescale > 0, start.epoch == 0, nominalEnd.epoch == 0,
            start.value >= 0, nominalEnd.time > start.time else { throw ProbeCameraMedia.invalid("Invalid rational camera interval.") }
        let first = CMTimeConvertScale(start.time, timescale: scale, method: .roundHalfAwayFromZero)
        let last = CMTimeConvertScale(nominalEnd.time, timescale: scale, method: .roundHalfAwayFromZero)
        guard last > first else { throw ProbeCameraMedia.invalid("Camera interval cannot fit its writer timescale.") }
        return CMTimeRange(start: first, end: last)
    }
}

/// The probe's only canonical camera closure/replay owner. Raw files and observations stay retained.
package enum ProbeCameraMedia {
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
    }
    private struct Row: Decodable {
        let role: ProbeRole
        let disposition: String
        let cameraFrame: ProbeCameraFrame?
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
    private final class Mapping {
        private let input: FileHandle
        private var pending = Data()
        private var eof = false
        private var lines = 0
        private(set) var frames = 0
        private(set) var torn = false
        init(_ url: URL) throws { input = try FileHandle(forReadingFrom: url) }
        deinit { try? input.close() }
        func next() throws -> ProbeCameraFrame? {
            while true {
                try Task.checkCancellation()
                if let end = pending.firstIndex(of: 10) {
                    let data = Data(pending[..<end]); pending.removeSubrange(...end)
                    lines += 1
                    guard lines <= 5_000_000, data.count <= 65536 else { throw invalid("Observation bounds exceeded.") }
                    let row = try JSONDecoder().decode(Row.self, from: data)
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
                    let chunk = try input.read(upToCount: 65536) ?? Data()
                    if chunk.isEmpty { eof = true } else { pending.append(chunk) }
                }
            }
        }
    }
    private final class Pictures {
        let asset: AVURLAsset
        let track: AVAssetTrack
        let segments: [SourceSegment]
        let reader: AVAssetReader
        let output: AVAssetReaderTrackOutput
        let scale: Int32
        private(set) var lastEnd = CMTime.invalid
        init(url: URL) async throws {
            asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
            guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw invalid("No camera video track.") }
            self.track = track
            scale = try await track.load(.naturalTimeScale)
            segments = SourceSegment.occupied(of: try await track.load(.segments))
            reader = try AVAssetReader(asset: asset)
            output = AVAssetReaderTrackOutput(track: track,
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

    package static func publish(lease: CaptureJournalLease, observationURL: URL) async throws -> Receipt {
        try Task.checkCancellation(); try lease.check()
        let root = URL(fileURLWithPath: lease.directory)
        let rawURL = root.appendingPathComponent("camera.raw.mov")
        let markerURL = root.appendingPathComponent("camera.closed.json")
        let receiptURL = root.appendingPathComponent("camera.publication.json")
        let canonicalURL = root.appendingPathComponent("video.mov")
        let rawIdentity = try CaptureMediaIdentity.read(rawURL)
        let observationIdentity = try CaptureMediaIdentity.read(observationURL)
        let closed = FileManager.default.fileExists(atPath: markerURL.path) ? try CaptureMediaIdentity.read(markerURL) : nil
        if closed != nil {
            let pinned = try JSONDecoder().decode(CaptureMediaIdentity.self, from: Data(contentsOf: markerURL))
            guard pinned == rawIdentity else { throw invalid("Closed camera payload changed.") }
        }
        func unchanged() throws {
            try lease.check(); try Task.checkCancellation()
            guard try CaptureMediaIdentity.read(rawURL) == rawIdentity,
                try CaptureMediaIdentity.read(observationURL) == observationIdentity,
                (FileManager.default.fileExists(atPath: markerURL.path) ? try CaptureMediaIdentity.read(markerURL) : nil) == closed else { throw invalid("Camera input changed during publication.") }
        }
        if FileManager.default.fileExists(atPath: receiptURL.path) {
            let receipt = try JSONDecoder().decode(Receipt.self, from: Data(contentsOf: receiptURL))
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
                try unchanged(); _ = try NewFile.publish(staged: candidate, at: canonicalURL.path)
            }
            guard try CaptureMediaIdentity.read(canonicalURL) == receipt.canonical else {
                throw invalid("Published camera identity conflicts; no replacement performed.")
            }
            try unchanged()
            return receipt
        }
        let mapping = try Mapping(observationURL)
        let raw = try await Pictures(url: rawURL)
        var support: CMTimeRange?; var rawHash = SHA256(); var diagnostics: [String] = []
        var represented = 0
        var previousMappedStart: CMTime?
        if closed == nil { diagnostics.append("unsealedRaw") }
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
        let file = try NewFile(at: canonicalURL.path, assembledAs: "camera.mov")
        // Keep failed candidates for diagnosis/recovery; raw media and mapping are never removed.
        let composition = AVMutableComposition()
        guard let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw invalid("Cannot construct canonical camera track.") }
        track.naturalTimeScale = raw.scale
        track.preferredTransform = try await raw.track.load(.preferredTransform)
        var pieces: [AVCompositionTrackSegment] = []
        if support.start > .zero {
            pieces.append(AVCompositionTrackSegment(timeRange: CMTimeRange(start: .zero, end: support.start)))
        }
        pieces.append(AVCompositionTrackSegment(url: rawURL, trackID: raw.track.trackID,
            sourceTimeRange: support, targetTimeRange: support))
        try track.validateSegments(pieces); track.segments = pieces
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else { throw invalid("Cannot export camera edit list.") }
        try await export.export(to: file.url, as: .mov)
        try Task.checkCancellation()
        let candidate = try await Pictures(url: file.url)
        guard merged(candidate.segments.map(\.asset)) == [support] else { throw invalid("Canonical camera support differs from accepted mapping.") }
        var candidateHash = SHA256()
        let replay = try Mapping(observationURL)
        for _ in 0..<represented {
            guard let frame = try replay.next() else { throw invalid("Camera mapping changed during verification.") }
            let range = try frame.acquisitionRange(scale: raw.scale)
            guard let sample = try candidate.next(), sample.presentationTimeStamp == range.start else { throw invalid("Canonical camera picture order changed.") }
            try digest(sample, into: &candidateHash, scale: raw.scale)
        }
        guard try candidate.next() == nil, hex(candidateHash.finalize()) == pictureHash else { throw invalid("Canonical camera pixels changed.") }
        try unchanged()
        let receipt = Receipt(presentation: .nativeBounded, raw: rawIdentity, observations: observationIdentity, closed: closed,
            canonical: try CaptureMediaIdentity.read(file.url),
            candidate: file.url.deletingLastPathComponent().lastPathComponent + "/" + file.url.lastPathComponent,
            representedFrames: represented, firstUs: CMTimeConvertScale(support.start, timescale: 1000000, method: .roundHalfAwayFromZero).value,
            endUs: CMTimeConvertScale(support.end, timescale: 1000000, method: .roundHalfAwayFromZero).value,
            pictureSHA256: pictureHash, diagnostics: diagnostics)
        try lease.synchronize()
        try save(receipt, to: receiptURL)
        try unchanged()
        _ = try file.publish()
        return receipt
    }
}
