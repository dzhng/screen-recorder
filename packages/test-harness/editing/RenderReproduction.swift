@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Window: Codable { let startUs: Int64; let endUs: Int64 }
struct Picture: Codable {
    let id: String; let file: String; let source: Window; let project: Window
    let holdUs: Int64?
    let unavailable: [Window]?
}
struct Sound: Codable {
    let file: String; let source: Window; let atUs: Int64; let gain: Float
}
struct Request: Codable {
    let width: Int; let height: Int; let fps: Int32; let range: Window
    let pictures: [Picture]; let audio: [Sound]; let output: String
    let colorPolicy: String
    let videoBitrate: Int?
    let savePreEncode: Bool?
}
func failure(_ message: String) -> NSError { NSError(domain: "RenderReproduction", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

final class Source {
    let track: AVAssetTrack
    let transform: CGAffineTransform
    let segments: [AVAssetTrackSegment]
    let occupied: [SourceSegment]
    let reader: AVAssetReader
    let output: AVAssetReaderTrackOutput
    var held: CMSampleBuffer?
    var heldStart = CMTime.invalid
    var heldEnd = CMTime.invalid
    var decoded = 0
    init(file: String, startUs: Int64, endUs: Int64) async throws {
        let asset = AVURLAsset(url: URL(fileURLWithPath: file))
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { throw failure("No video") }
        self.track = track
        transform = try await track.load(.preferredTransform)
        segments = try await track.load(.segments)
        occupied = SourceSegment.occupied(of: segments)
        let start = time(microseconds: startUs)
        var decodeStart = start
        if let segment = occupied.first(where: { $0.asset.containsTime(start) }),
           let cursor = track.makeSampleCursor(presentationTimeStamp: segment.mediaTime(ofAsset: start)) {
            decodeStart = segment.assetTime(ofMedia: cursor.presentationTimeStamp)
        }
        reader = try AVAssetReader(asset: asset)
        output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        reader.timeRange = CMTimeRange(start: decodeStart, end: time(microseconds: endUs))
        guard reader.startReading() else { throw reader.error ?? failure("Reader start") }
    }
    deinit { reader.cancelReading() }
    func select(_ at: CMTime) throws -> CVPixelBuffer? {
        guard let segment = segments.first(where: { $0.timeMapping.target.containsTime(at) }) else { throw failure("UNAVAILABLE: no source segment") }
        if segment.isEmpty { return nil }
        while held == nil || heldEnd <= at {
            held = nil
            guard let sample = output.copyNextSampleBuffer() else { throw reader.error ?? failure("UNAVAILABLE: decoder exhausted") }
            decoded += 1
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            guard let end = assetEnd(ofSamplePresentedAt: pts, in: occupied, of: track) else { continue }
            held = sample; heldStart = pts; heldEnd = end
        }
        guard heldStart <= at, let buffer = CMSampleBufferGetImageBuffer(held!) else { throw failure("UNAVAILABLE: unsupported sample interval") }
        return buffer
    }
}

func image(_ buffer: CVPixelBuffer, transform: CGAffineTransform, width: Int, height: Int, policy: String) -> CIImage {
    let decoded = policy == "assume-srgb"
        ? CIImage(cvPixelBuffer: buffer, options: [.colorSpace: srgb])
        : CIImage(cvPixelBuffer: buffer)
    let flip = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: decoded.extent.height)
    let displayed = decoded.extent.applying(transform)
    let unflip = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: displayed.height)
    var oriented = decoded.transformed(by: flip.concatenating(transform).concatenating(unflip))
    oriented = oriented.transformed(by: CGAffineTransform(translationX: -oriented.extent.minX, y: -oriented.extent.minY))
    let scale = min(CGFloat(width) / oriented.extent.width, CGFloat(height) / oriented.extent.height)
    oriented = oriented.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    return oriented.transformed(by: CGAffineTransform(translationX: (CGFloat(width) - oriented.extent.width) / 2, y: (CGFloat(height) - oriented.extent.height) / 2))
}
func png(_ image: CIImage, at file: String) throws {
    let context = CIContext(options: [.cacheIntermediates: false])
    try context.writePNGRepresentation(of: image, to: URL(fileURLWithPath: file), format: .RGBA8, colorSpace: srgb)
}
func audioComposition(_ request: Request) async throws -> (AVMutableComposition, AVMutableAudioMix) {
    let composition = AVMutableComposition()
    var parameters: [AVMutableAudioMixInputParameters] = []
    for sound in request.audio {
        let asset = AVURLAsset(url: URL(fileURLWithPath: sound.file))
        guard let source = try await asset.loadTracks(withMediaType: .audio).first,
              let target = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw failure("No audio") }
        try target.insertTimeRange(CMTimeRange(start: time(microseconds: sound.source.startUs), end: time(microseconds: sound.source.endUs)), of: source, at: time(microseconds: sound.atUs))
        let parameter = AVMutableAudioMixInputParameters(track: target)
        parameter.setVolume(sound.gain, at: .zero); parameters.append(parameter)
    }
    let mix = AVMutableAudioMix(); mix.inputParameters = parameters
    return (composition, mix)
}
func wait(_ input: AVAssetWriterInput, writer: AVAssetWriter) async throws {
    let deadline = ContinuousClock.now.advanced(by: .seconds(10))
    while !input.isReadyForMoreMediaData {
        guard writer.status == .writing, ContinuousClock.now < deadline else { throw writer.error ?? failure("Writer made no progress") }
        try await Task.sleep(for: .milliseconds(1))
    }
}
func audio(_ request: Request, writer: AVAssetWriter?, input: AVAssetWriterInput?, rawFile: String) async throws -> Int {
    let (composition, mix) = try await audioComposition(request)
    let reader = try AVAssetReader(asset: composition)
    let output = AVAssetReaderAudioMixOutput(audioTracks: try await composition.loadTracks(withMediaType: .audio), audioSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false])
    output.audioMix = mix
    reader.add(output)
    reader.timeRange = CMTimeRange(start: time(microseconds: request.range.startUs), end: time(microseconds: request.range.endUs))
    guard reader.startReading() else { throw reader.error ?? failure("Audio reader start") }
    defer { reader.cancelReading() }
    FileManager.default.createFile(atPath: rawFile, contents: nil)
    let file = try FileHandle(forWritingTo: URL(fileURLWithPath: rawFile)); defer { try? file.close() }
    var frames = 0
    while let sample = output.copyNextSampleBuffer() {
        let count = CMSampleBufferGetNumSamples(sample); frames += count
        guard let block = CMSampleBufferGetDataBuffer(sample) else { throw failure("Missing PCM") }
        var bytes = Data(count: CMBlockBufferGetDataLength(block))
        let copied = bytes.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!) }
        guard copied == noErr else { throw failure("PCM copy") }
        try file.write(contentsOf: bytes)
        if let writer, let input {
            var needed = 0
            CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &needed)
            var timings = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: needed)
            CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: needed, arrayToFill: &timings, entriesNeededOut: &needed)
            for i in timings.indices { timings[i].presentationTimeStamp = CMTimeSubtract(timings[i].presentationTimeStamp, time(microseconds: request.range.startUs)) }
            var shifted: CMSampleBuffer?
            guard CMSampleBufferCreateCopyWithNewTiming(allocator: nil, sampleBuffer: sample, sampleTimingEntryCount: needed, sampleTimingArray: &timings, sampleBufferOut: &shifted) == noErr else { throw failure("Audio timestamp shift") }
            try await wait(input, writer: writer)
            guard input.append(shifted!) else { throw writer.error ?? failure("Audio append") }
        }
    }
    guard reader.status == .completed else { throw reader.error ?? failure("Audio reader incomplete") }
    input?.markAsFinished()
    return frames
}
func bounded(_ request: Request) async throws -> [String: Any] {
    let writer = try AVAssetWriter(outputURL: URL(fileURLWithPath: request.output + "/bounded.mov"), fileType: .mov)
    let video = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: request.width, AVVideoHeightKey: request.height, AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false, AVVideoAverageBitRateKey: request.videoBitrate ?? 4_000_000]])
    video.mediaTimeScale = 1_000_000; writer.movieTimeScale = 1_000_000; writer.add(video)
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: request.width, kCVPixelBufferHeightKey as String: request.height, kCVPixelBufferIOSurfacePropertiesKey as String: [:]])
    let sound = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
    if !request.audio.isEmpty { writer.add(sound) }
    guard writer.startWriting() else { throw writer.error ?? failure("Writer start") }
    writer.startSession(atSourceTime: .zero)
    defer { if writer.status == .writing { writer.cancelWriting() } }
    async let audioFrames = request.audio.isEmpty ? 0 : audio(request, writer: writer, input: sound, rawFile: request.output + "/audio.f32le")
    let context = CIContext(options: [.cacheIntermediates: false])
    let background = CIImage(color: .black).cropped(to: CGRect(x: 0, y: 0, width: request.width, height: request.height))
    var current: Source?, currentID: String?
    var decoded: [String: Int] = [:], rows: [[String: Any]] = []
    let tick: Int64 = 1_000_000 / Int64(request.fps)
    var project = request.range.startUs / tick * tick
    while project < request.range.endUs {
        let visibleStart = max(project, request.range.startUs)
        let visibleEnd = min(project + tick, request.range.endUs)
        let picture = request.pictures.first { project >= $0.project.startUs && project < $0.project.endUs }
        var frame = background
        var row: [String: Any] = ["sampleProjectUs": project, "visibleStartUs": visibleStart, "visibleEndUs": visibleEnd]
        if let picture {
            let atUs = picture.holdUs ?? (picture.source.startUs + project - picture.project.startUs)
            if currentID != picture.id {
                if let id = currentID, let source = current { decoded[id] = source.decoded }
                current = nil
                current = try await Source(file: picture.file, startUs: atUs, endUs: picture.holdUs.map { $0 + 1 } ?? picture.source.endUs)
                currentID = picture.id
            }
            let source = current!
            row["clipId"] = picture.id; row["sourceUs"] = atUs
            if let buffer = try source.select(time(microseconds: atUs)) {
                frame = image(buffer, transform: source.transform, width: request.width, height: request.height, policy: request.colorPolicy).composited(over: background)
                row["sourceSampleUs"] = microseconds(source.heldStart)
            } else { row["emptyEdit"] = true }
        } else { row["projectGap"] = true }
        try await wait(video, writer: writer)
        var destination: CVPixelBuffer?
        guard let pool = adaptor.pixelBufferPool,
              CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(nil, pool, [kCVPixelBufferPoolAllocationThresholdKey: 4] as CFDictionary, &destination) == kCVReturnSuccess else { throw failure("Bounded pixel allocation") }
        context.render(frame, to: destination!, bounds: CGRect(x: 0, y: 0, width: request.width, height: request.height), colorSpace: srgb)
        CVBufferSetAttachment(destination!, kCVImageBufferColorPrimariesKey, kCVImageBufferColorPrimaries_ITU_R_709_2, .shouldPropagate)
        CVBufferSetAttachment(destination!, kCVImageBufferTransferFunctionKey, kCVImageBufferTransferFunction_sRGB, .shouldPropagate)
        CVBufferSetAttachment(destination!, kCVImageBufferYCbCrMatrixKey, kCVImageBufferYCbCrMatrix_ITU_R_709_2, .shouldPropagate)
        if request.savePreEncode == true && rows.isEmpty {
            try png(CIImage(cvPixelBuffer: destination!), at: request.output + "/pre-encode.png")
        }
        var format: CMVideoFormatDescription?, sample: CMSampleBuffer?
        var timing = CMSampleTimingInfo(duration: time(microseconds: visibleEnd - visibleStart), presentationTimeStamp: time(microseconds: visibleStart - request.range.startUs), decodeTimeStamp: .invalid)
        guard CMVideoFormatDescriptionCreateForImageBuffer(allocator: nil, imageBuffer: destination!, formatDescriptionOut: &format) == noErr,
              CMSampleBufferCreateReadyWithImageBuffer(allocator: nil, imageBuffer: destination!, formatDescription: format!, sampleTiming: &timing, sampleBufferOut: &sample) == noErr,
              video.append(sample!) else { throw writer.error ?? failure("Video append") }
        rows.append(row); project += tick
    }
    video.markAsFinished()
    let audioCount = try await audioFrames
    writer.endSession(atSourceTime: time(microseconds: request.range.endUs - request.range.startUs))
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? failure("Writer incomplete") }
    if let id = currentID, let source = current { decoded[id] = source.decoded }
    return ["rows": rows, "audioFrames": audioCount, "decodedPerOccurrence": decoded, "retainedSourceBuffersBound": 1, "pixelPoolAllocationThreshold": 4]
}
func composition(_ request: Request) async throws -> [String: Any] {
    let (composition, mix) = try await audioComposition(request)
    var instructions: [AVMutableVideoCompositionInstruction] = []
    for picture in request.pictures {
        let asset = AVURLAsset(url: URL(fileURLWithPath: picture.file))
        let source = try await asset.loadTracks(withMediaType: .video).first!
        let target = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        let sourceRange = CMTimeRange(start: time(microseconds: picture.holdUs ?? picture.source.startUs), duration: time(microseconds: picture.holdUs == nil ? picture.source.endUs - picture.source.startUs : 1))
        try target.insertTimeRange(sourceRange, of: source, at: time(microseconds: picture.project.startUs))
        if picture.holdUs != nil { target.scaleTimeRange(CMTimeRange(start: time(microseconds: picture.project.startUs), duration: sourceRange.duration), toDuration: time(microseconds: picture.project.endUs - picture.project.startUs)) }
        let transform = try await source.load(.preferredTransform)
        let natural = try await source.load(.naturalSize)
        let bounds = CGRect(origin: .zero, size: natural).applying(transform)
        let scale = min(CGFloat(request.width) / bounds.width, CGFloat(request.height) / bounds.height)
        let fit = transform.concatenating(CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY)).concatenating(CGAffineTransform(scaleX: scale, y: scale)).concatenating(CGAffineTransform(translationX: (CGFloat(request.width) - bounds.width * scale) / 2, y: (CGFloat(request.height) - bounds.height * scale) / 2))
        let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: target); layer.setTransform(fit, at: .zero)
        let instruction = AVMutableVideoCompositionInstruction(); instruction.timeRange = CMTimeRange(start: time(microseconds: picture.project.startUs), end: time(microseconds: picture.project.endUs)); instruction.layerInstructions = [layer]; instruction.backgroundColor = CGColor(gray: 0, alpha: 1); instructions.append(instruction)
    }
    let video = AVMutableVideoComposition(); video.renderSize = CGSize(width: request.width, height: request.height); video.frameDuration = CMTime(value: 1, timescale: request.fps); video.instructions = instructions
    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { throw failure("Export creation") }
    exporter.videoComposition = video; exporter.audioMix = mix
    exporter.timeRange = CMTimeRange(start: time(microseconds: request.range.startUs), end: time(microseconds: request.range.endUs))
    try await exporter.export(to: URL(fileURLWithPath: request.output + "/composition.mov"), as: .mov)
    return ["durationUs": microseconds(try await AVURLAsset(url: URL(fileURLWithPath: request.output + "/composition.mov")).load(.duration))]
}
func gap(_ sourceFile: String, _ output: String) async throws {
    let asset = AVURLAsset(url: URL(fileURLWithPath: sourceFile))
    let source = try await asset.loadTracks(withMediaType: .video).first!
    let composition = AVMutableComposition()
    let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try track.insertTimeRange(CMTimeRange(start: .zero, duration: time(microseconds: 250000)), of: source, at: .zero)
    track.insertEmptyTimeRange(CMTimeRange(start: time(microseconds: 250000), duration: time(microseconds: 500000)))
    try track.insertTimeRange(CMTimeRange(start: time(microseconds: 250000), duration: time(microseconds: 500000)), of: source, at: time(microseconds: 750000))
    let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
    try await export.export(to: URL(fileURLWithPath: output), as: .mov)
}
func color(_ sourceFile: String, _ output: String) async throws {
    let source = try await Source(file: sourceFile, startUs: 0, endUs: 1)
    let buffer = try source.select(.zero)!
    CVPixelBufferLockBaseAddress(buffer, .readOnly); defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    let base = CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to: UInt8.self)
    let offset = 4 * CVPixelBufferGetBytesPerRow(buffer) + 4 * 4
    let raw = [base[offset + 2], base[offset + 1], base[offset]]
    for policy in ["native", "assume-srgb"] {
        try png(image(buffer, transform: .identity, width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer), policy: policy), at: output + "/" + policy + ".png")
    }
    let attachments = CVBufferCopyAttachments(buffer, .shouldPropagate).map { String(describing: $0) } ?? "none"
    print(String(data: try JSONSerialization.data(withJSONObject: ["rawRedRgb": raw, "attachments": attachments], options: [.sortedKeys]), encoding: .utf8)!)
}
@main struct Probe {
    static func main() async {
        do { try await run() }
        catch {
            let bytes = try! JSONSerialization.data(withJSONObject: ["error": String(describing: error)], options: [.sortedKeys])
            print(String(data: bytes, encoding: .utf8)!)
            exit(1)
        }
    }
    static func run() async throws {
        let args = CommandLine.arguments
        if args[1] == "reference" {
            let source = try await Source(file: args[2], startUs: 0, endUs: 1)
            let buffer = try source.select(.zero)!
            let width = Int(args[4])!, height = Int(args[5])!
            let policy = args.count > 6 ? args[6] : "native"
            try png(image(buffer, transform: source.transform, width: width, height: height, policy: policy), at: args[3])
            let transform = source.transform
            let attachments = CVBufferCopyAttachments(buffer, .shouldPropagate).map { String(describing: $0) } ?? "none"
            let report: [String: Any] = ["transform": [transform.a, transform.b, transform.c, transform.d, transform.tx, transform.ty], "attachments": attachments, "width": width, "height": height, "policy": policy]
            print(String(data: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]), encoding: .utf8)!)
            return
        }
        if args[1] == "gap" { try await gap(args[2], args[3]); return }
        if args[1] == "color" { try await color(args[2], args[3]); return }
        let request = try JSONDecoder().decode(Request.self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
        guard request.fps > 0, 1_000_000 % request.fps == 0 else { throw failure("Probe requires an integral-microsecond frame period; production compilation is separate") }
        var through: Int64 = 0
        for picture in request.pictures {
            guard picture.project.startUs >= through, picture.project.endUs > picture.project.startUs else { throw failure("Probe supports an ordered single visible layer") }
            through = picture.project.endUs
            guard picture.holdUs != nil || picture.source.endUs - picture.source.startUs == picture.project.endUs - picture.project.startUs else { throw failure("Probe does not implement retiming") }
            for gap in picture.unavailable ?? [] {
                let selectedStart = max(picture.project.startUs, request.range.startUs / (1_000_000 / Int64(request.fps)) * (1_000_000 / Int64(request.fps)))
                let selectedEnd = min(picture.project.endUs, request.range.endUs)
                let sourceStart = picture.holdUs ?? (picture.source.startUs + selectedStart - picture.project.startUs)
                let sourceEnd = picture.holdUs.map { $0 + 1 } ?? (picture.source.startUs + selectedEnd - picture.project.startUs)
                if selectedStart < selectedEnd && sourceStart < gap.endUs && sourceEnd > gap.startUs {
                    throw failure("UNAVAILABLE_ACQUISITION: \(picture.id)")
                }
            }
        }
        let started = ContinuousClock.now
        let result = try await (args[1] == "composition" ? composition(request) : bounded(request))
        var report = result
        let elapsed = started.duration(to: .now)
        report["elapsedSeconds"] = Double(elapsed.components.attoseconds) / 1e18 + Double(elapsed.components.seconds)
        print(String(data: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]), encoding: .utf8)!)
    }
}
