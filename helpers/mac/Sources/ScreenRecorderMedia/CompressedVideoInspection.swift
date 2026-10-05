@preconcurrency import AVFoundation
import Foundation

/// Explicit, complete decode-packet inspection is separate from presented timing evidence.
public struct ProbedCompressedVideo: Encodable, Sendable {
    public let status: String
    public let packetCount: Int64
    public let nalTypes: [Int]
    public let configurationNalTypes: [Int]
    public let seiPayloadTypes: [Int]
    public let refusals: [String]
}

package enum CompressedVideoInspection {
    private static let packetBudget = 32 * 1024 * 1024

    package static func inspect(input: MediaInput, track: AVAssetTrack) throws -> ProbedCompressedVideo {
        guard let cursor = track.makeSampleCursorAtFirstSampleInDecodeOrder() else {
            return ProbedCompressedVideo(status: "incomplete", packetCount: 0,
                nalTypes: [], configurationNalTypes: [], seiPayloadTypes: [], refusals: ["missing compressed cursor"])
        }
        let generator = AVSampleBufferGenerator(asset: input.asset, timebase: nil)
        var parser = HEVCInterpretationInventory()
        var count: Int64 = 0
        var previousFormat: CMFormatDescription?
        repeat {
            try Task.checkCancellation()
            if !input.ownsStorage(of: cursor) {
                return parser.result(status: "incomplete", count: count, reason: "external compressed storage is unqualified")
            }
            let storage = cursor.currentSampleStorageRange
            guard storage.offset >= 0, storage.length > 0, storage.length <= Int64(packetBudget) else {
                return parser.result(status: "incomplete", count: count, reason: "compressed storage exceeds inspection budget")
            }
            let refusal: ProbedCompressedVideo? = try autoreleasepool {
                let request = AVSampleBufferRequest(start: cursor)
                request.direction = .none
                request.mode = .immediate
                let sample = try generator.makeSampleBuffer(for: request)
                guard sample.isValid, CMSampleBufferDataIsReady(sample), sample.numSamples == 1,
                    let block = sample.dataBuffer, let format = sample.formatDescription,
                    CMFormatDescriptionEqual(format, otherFormatDescription: cursor.copyCurrentSampleFormatDescription()),
                    sample.presentationTimeStamp == cursor.presentationTimeStamp,
                    sample.decodeTimeStamp == cursor.decodeTimeStamp,
                    sample.duration == cursor.currentSampleDuration else {
                    throw NativeFailure("UNSUPPORTED_MEDIA", "Compressed sample lost its native cursor identity.")
                }
                guard CMFormatDescriptionGetMediaSubType(format) == kCMVideoCodecType_HEVC else {
                    return parser.result(status: "unsupported", count: count, reason: "only hvc1 packets are qualified")
                }
                var headerLength: Int32 = 0
                let status = CMVideoFormatDescriptionGetHEVCParameterSetAtIndex(format,
                    parameterSetIndex: 0, parameterSetPointerOut: nil, parameterSetSizeOut: nil,
                    parameterSetCountOut: nil, nalUnitHeaderLengthOut: &headerLength)
                guard status == noErr, [1, 2, 4].contains(headerLength) else {
                    return parser.result(status: "incomplete", count: count, reason: "unknown NAL length framing")
                }
                if previousFormat.map({ !CMFormatDescriptionEqual($0, otherFormatDescription: format) }) ?? true {
                    if previousFormat != nil { parser.recordFormatChange() }
                    let atoms = CMFormatDescriptionGetExtension(format,
                        extensionKey: kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms) as? [String: Any]
                    guard let config = atoms?["hvcC"] as? Data, config.count <= packetBudget else {
                        return parser.result(status: "incomplete", count: count, reason: "missing or oversized hvcC configuration")
                    }
                    do { try parser.visitConfiguration(config, lengthBytes: Int(headerLength)) }
                    catch is CancellationError { throw CancellationError() }
                    catch { return parser.result(status: "incomplete", count: count, reason: "malformed hvcC configuration") }
                    previousFormat = format
                }
                let length = CMBlockBufferGetDataLength(block)
                guard length > 0, length <= packetBudget else {
                    return parser.result(status: "incomplete", count: count, reason: "compressed packet exceeds inspection budget")
                }
                var bytes = Data(count: length)
                let copied = bytes.withUnsafeMutableBytes {
                    CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!)
                }
                guard copied == noErr else {
                    return parser.result(status: "incomplete", count: count, reason: "compressed packet cannot be read")
                }
                do { try parser.visit(bytes, lengthBytes: Int(headerLength)) }
                catch is CancellationError { throw CancellationError() }
                catch { return parser.result(status: "incomplete", count: count, reason: "malformed HEVC packet framing") }
                return nil
            }
            if let refusal { return refusal }
            count += 1
            let before = cursor.decodeTimeStamp
            guard before.isNumeric else {
                return parser.result(status: "incomplete", count: count, reason: "nonfinite compressed decode clock")
            }
            let advanced = cursor.stepInDecodeOrder(byCount: 1)
            if advanced == 0 { break }
            guard advanced == 1, cursor.decodeTimeStamp.isNumeric, cursor.decodeTimeStamp > before else {
                return parser.result(status: "incomplete", count: count, reason: "compressed inventory made no progress")
            }
        } while true
        return parser.result(status: "complete", count: count)
    }
}

/// Numeric identities follow H.265 tables; everything beyond the frozen subset refuses.
private struct HEVCInterpretationInventory {
    private var nalTypes = Set<Int>()
    private var configurationNalTypes = Set<Int>()
    private var seiTypes = Set<Int>()
    private var refusals = Set<String>()
    private enum Malformed: Error { case packet }

    func result(status: String, count: Int64, reason: String? = nil) -> ProbedCompressedVideo {
        var reasons = refusals
        if let reason { reasons.insert(reason) }
        return ProbedCompressedVideo(status: status, packetCount: count,
            nalTypes: nalTypes.sorted(), configurationNalTypes: configurationNalTypes.sorted(), seiPayloadTypes: seiTypes.sorted(), refusals: reasons.sorted())
    }

    mutating func recordFormatChange() { refusals.insert("changing compressed formats are unqualified") }

    mutating func visit(_ data: Data, lengthBytes: Int) throws {
        var at = 0
        while at < data.count {
            try Task.checkCancellation()
            guard data.count - at >= lengthBytes else { throw Malformed.packet }
            var length = 0
            for byte in data[at..<(at + lengthBytes)] { length = length * 256 + Int(byte) }
            at += lengthBytes
            guard length >= 2, length <= data.count - at else { throw Malformed.packet }
            try visitNAL(data, at: at, length: length, configurationType: nil)
            at += length
        }
    }

    mutating func visitConfiguration(_ data: Data, lengthBytes: Int) throws {
        guard data.count >= 23, data[0] == 1, Int(data[21] & 3) + 1 == lengthBytes else {
            throw Malformed.packet
        }
        var at = 23
        var parameterSets = Set<Int>()
        for _ in 0..<Int(data[22]) {
            try Task.checkCancellation()
            guard data.count - at >= 3, data[at] & 0x40 == 0 else { throw Malformed.packet }
            let type = Int(data[at] & 63), complete = data[at] & 0x80 != 0
            if (32...34).contains(type), !complete { refusals.insert("incomplete hvc1 parameter-set array") }
            let count = Int(data[at + 1]) * 256 + Int(data[at + 2]); at += 3
            if (32...34).contains(type), count != 1 || parameterSets.contains(type) {
                refusals.insert("multiple parameter-set declarations are unqualified")
            }
            for _ in 0..<count {
                try Task.checkCancellation()
                guard data.count - at >= 2 else { throw Malformed.packet }
                let length = Int(data[at]) * 256 + Int(data[at + 1]); at += 2
                guard length >= 2, length <= data.count - at else { throw Malformed.packet }
                try visitNAL(data, at: at, length: length, configurationType: type)
                if (32...34).contains(type) { parameterSets.insert(type) }
                at += length
            }
        }
        guard at == data.count, [32, 33, 34].allSatisfy({ parameterSets.contains($0) }) else {
            throw Malformed.packet
        }
    }

    private mutating func visitNAL(_ data: Data, at: Int, length: Int, configurationType: Int?) throws {
        let first = data[at], second = data[at + 1]
        guard first & 0x80 == 0, second & 7 != 0 else { throw Malformed.packet }
        let type = Int((first >> 1) & 63)
        let layer = Int(first & 1) * 32 + Int(second >> 3)
        if let configurationType {
            guard configurationType == type else { throw Malformed.packet }
            configurationNalTypes.insert(type)
        } else { nalTypes.insert(type) }
        if layer != 0 { refusals.insert("multilayer HEVC is unqualified") }
        if type == 39 || type == 40 { try visitSEI(data[(at + 2)..<(at + length)]) }
        else {
            let allowed = configurationType != nil ? (32...34).contains(type) :
                (0...9).contains(type) || (16...21).contains(type) || (35...38).contains(type)
            if !allowed { refusals.insert("unqualified NAL type \(type)") }
        }
    }

    private mutating func visitSEI(_ payload: Data.SubSequence) throws {
        var rbsp = [UInt8]()
        rbsp.reserveCapacity(payload.count)
        var zeros = 0
        var escaped = false
        for (index, byte) in payload.enumerated() {
            if index % 65536 == 0 { try Task.checkCancellation() }
            if escaped {
                guard byte <= 3 else { throw Malformed.packet }
                escaped = false
            } else if zeros >= 2 {
                if byte == 3 { escaped = true; zeros = 0; continue }
                guard byte > 2 else { throw Malformed.packet }
            }
            rbsp.append(byte)
            zeros = byte == 0 ? zeros + 1 : 0
        }
        guard !escaped, rbsp.last == 0x80 else { throw Malformed.packet }
        var at = 0
        func number() throws -> Int {
            var value = 0
            while at < rbsp.count - 1 {
                let byte = Int(rbsp[at]); at += 1
                guard value <= 1_048_576 - byte else { throw Malformed.packet }
                value += byte
                if byte != 255 { return value }
                if at % 65536 == 0 { try Task.checkCancellation() }
            }
            throw Malformed.packet
        }
        while at < rbsp.count - 1 {
            try Task.checkCancellation()
            let type = try number(), size = try number()
            guard size <= rbsp.count - 1 - at else { throw Malformed.packet }
            // Bound evidence even for an adversarial packet with many distinct payload types.
            guard seiTypes.contains(type) || seiTypes.count < 128 else { throw Malformed.packet }
            seiTypes.insert(type)
            if type == 3 {
                guard rbsp[at..<(at + size)].allSatisfy({ $0 == 0xff }) else { throw Malformed.packet }
            } else { refusals.insert("unqualified SEI payload \(type)") }
            at += size
        }
    }
}
