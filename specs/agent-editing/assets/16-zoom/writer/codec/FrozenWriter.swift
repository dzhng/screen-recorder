@preconcurrency import AVFoundation
import CoreVideo
import Foundation

@main struct FrozenWriter {
    static func main() async throws {
        let input = URL(fileURLWithPath: CommandLine.arguments[1])
        let output = URL(fileURLWithPath: CommandLine.arguments[2])
        let variant = CommandLine.arguments[3]
        let prores = variant == "prores4444"
        let first = try JSONSerialization.jsonObject(with: Data(contentsOf: input.appendingPathComponent("frame-0.json"))) as! [String: Any]
        let width = first["width"] as! Int, height = first["height"] as! Int
        let writer = try AVAssetWriter(outputURL: output, fileType: prores ? .mov : .mp4)
        var settings: [String: Any] = [
            AVVideoCodecKey: prores ? AVVideoCodecType.proRes4444 : AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]]
        if !prores {
            var compression: [String: Any] = [AVVideoAllowFrameReorderingKey: false]
            if variant == "h26440mbps" { compression[AVVideoAverageBitRateKey] = 40_000_000 }
            settings[AVVideoCompressionPropertiesKey] = compression
        }
        let video = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        video.mediaTimeScale = 1_000_000; writer.movieTimeScale = 1_000_000
        writer.add(video)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferIOSurfacePropertiesKey as String: [:]])
        precondition(writer.startWriting()); writer.startSession(atSourceTime: .zero)
        let color = CVImageBufferCreateColorSpaceFromAttachments([
            kCVImageBufferColorPrimariesKey: kCVImageBufferColorPrimaries_ITU_R_709_2,
            kCVImageBufferTransferFunctionKey: kCVImageBufferTransferFunction_ITU_R_709_2,
            kCVImageBufferYCbCrMatrixKey: kCVImageBufferYCbCrMatrix_ITU_R_709_2] as CFDictionary)!.takeRetainedValue()
        var endUs: Int64 = 0
        for index in 0..<24 {
            let record = try JSONSerialization.jsonObject(with: Data(contentsOf: input.appendingPathComponent("frame-\(index).json"))) as! [String: Any]
            let raw = try Data(contentsOf: input.appendingPathComponent("frame-\(index).bgra"))
            precondition(raw.count == width * height * 4)
            let deadline = ContinuousClock.now.advanced(by: .seconds(10))
            var pixel: CVPixelBuffer?
            while pixel == nil {
                precondition(writer.status == .writing && ContinuousClock.now < deadline)
                if video.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool {
                    let status = CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(nil, pool, [kCVPixelBufferPoolAllocationThresholdKey: 4] as CFDictionary, &pixel)
                    precondition(status == kCVReturnSuccess || status == kCVReturnWouldExceedAllocationThreshold)
                }
                if pixel == nil { try await Task.sleep(for: .milliseconds(1)) }
            }
            let destination = pixel!
            precondition(CVPixelBufferLockBaseAddress(destination, []) == kCVReturnSuccess)
            let address = CVPixelBufferGetBaseAddress(destination)!, stride = CVPixelBufferGetBytesPerRow(destination)
            raw.withUnsafeBytes { bytes in
                for y in 0..<height { memcpy(address.advanced(by: y * stride), bytes.baseAddress!.advanced(by: y * width * 4), width * 4) }
            }
            CVPixelBufferUnlockBaseAddress(destination, [])
            CVBufferSetAttachment(destination, kCVImageBufferCGColorSpaceKey, color, .shouldPropagate)
            CVBufferSetAttachment(destination, kCVImageBufferColorPrimariesKey, kCVImageBufferColorPrimaries_ITU_R_709_2, .shouldPropagate)
            CVBufferSetAttachment(destination, kCVImageBufferTransferFunctionKey, kCVImageBufferTransferFunction_ITU_R_709_2, .shouldPropagate)
            CVBufferSetAttachment(destination, kCVImageBufferYCbCrMatrixKey, kCVImageBufferYCbCrMatrix_ITU_R_709_2, .shouldPropagate)
            let at = (record["writerPTSUs"] as! NSNumber).int64Value, duration = (record["writerDurationUs"] as! NSNumber).int64Value
            var timing = CMSampleTimingInfo(duration: CMTime(value: duration, timescale: 1_000_000), presentationTimeStamp: CMTime(value: at, timescale: 1_000_000), decodeTimeStamp: .invalid)
            var format: CMVideoFormatDescription?, sample: CMSampleBuffer?
            precondition(CMVideoFormatDescriptionCreateForImageBuffer(allocator: nil, imageBuffer: destination, formatDescriptionOut: &format) == noErr)
            precondition(CMSampleBufferCreateReadyWithImageBuffer(allocator: nil, imageBuffer: destination, formatDescription: format!, sampleTiming: &timing, sampleBufferOut: &sample) == noErr)
            precondition(video.append(sample!)); endUs = at + duration
        }
        video.markAsFinished(); writer.endSession(atSourceTime: CMTime(value: endUs, timescale: 1_000_000))
        await writer.finishWriting(); precondition(writer.status == .completed)
        print("Encoded \(variant), \(endUs) microseconds")
    }
}
