@preconcurrency import AVFoundation
import CoreGraphics
import CoreImage
import CoreText
import Foundation
import ImageIO

/// Generated H.264 fixtures whose every frame states its own index: eight binary blocks a test can
/// read back, plus asymmetric corner markers that expose an orientation or crop-origin mistake, and
/// human-readable text and a labelled button for visual review. The button and the text are the
/// targets an overlay must stay readable over.
enum FixtureFrame {
    static let markerSize = 40
    static let blockSize = 30
    static let blockTop = 60
    static let blockStride = 36
    static let blockLeft = 10
    static let buttonLeft = 10
    static let buttonTop = 195
    static let buttonWidth = 120
    static let buttonHeight = 34

    static func blockCenter(bit: Int) -> CGPoint {
        CGPoint(
            x: blockLeft + bit * blockStride + blockSize / 2, y: blockTop + blockSize / 2)
    }

    static func draw(index: Int, atUs: Int64, width: Int, height: Int) -> CVPixelBuffer {
        var created: CVPixelBuffer?
        CVPixelBufferCreate(
            nil, width, height, kCVPixelFormatType_32BGRA,
            [
                kCVPixelBufferCGImageCompatibilityKey: true,
                kCVPixelBufferCGBitmapContextCompatibilityKey: true,
            ] as CFDictionary, &created)
        guard let buffer = created else { fatalError("Cannot allocate fixture pixel buffer") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard
            let context = CGContext(
                data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                    | CGBitmapInfo.byteOrder32Little.rawValue)
        else { fatalError("Cannot draw fixture frame") }
        // Core Graphics draws bottom-left; fixture geometry is stated in top-left pixels.
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        fill(context, 0, 0, width, height, (0.12, 0.12, 0.12))
        fill(context, 0, 0, markerSize, markerSize, (1, 0.1, 0.1))
        fill(context, width - markerSize, height - markerSize, markerSize, markerSize, (0.1, 0.3, 1))
        for bit in 0..<8 {
            let level: CGFloat = (index >> bit) & 1 == 1 ? 1 : 0
            fill(context, blockLeft + bit * blockStride, blockTop, blockSize, blockSize, (level, level, level))
        }
        text(context, "frame \(index)", x: 12, y: height - 70, size: 34)
        text(
            context, String(format: "t=%.3fs", Double(atUs) / 1_000_000), x: 12, y: height - 112,
            size: 26)
        fill(context, buttonLeft, buttonTop, buttonWidth, buttonHeight, (0.88, 0.88, 0.91))
        text(
            context, "Send", x: buttonLeft + 16, y: buttonTop + 26, size: 24,
            color: (0.05, 0.05, 0.08))
        return buffer
    }

    private static func fill(
        _ context: CGContext, _ x: Int, _ y: Int, _ width: Int, _ height: Int,
        _ color: (CGFloat, CGFloat, CGFloat)
    ) {
        context.setFillColor(CGColor(red: color.0, green: color.1, blue: color.2, alpha: 1))
        context.fill(CGRect(x: x, y: y, width: width, height: height))
    }

    private static func text(
        _ context: CGContext, _ value: String, x: Int, y: Int, size: CGFloat,
        color: (CGFloat, CGFloat, CGFloat) = (0.2, 1, 0.4)
    ) {
        let font = CTFontCreateWithName("Helvetica-Bold" as CFString, size, nil)
        let line = CTLineCreateWithAttributedString(
            NSAttributedString(
                string: value,
                attributes: [
                    kCTFontAttributeName as NSAttributedString.Key: font,
                    kCTForegroundColorAttributeName as NSAttributedString.Key: CGColor(
                        red: color.0, green: color.1, blue: color.2, alpha: 1),
                ]))
        context.saveGState()
        context.translateBy(x: CGFloat(x), y: CGFloat(y))
        context.scaleBy(x: 1, y: -1)
        context.textPosition = .zero
        CTLineDraw(line, context)
        context.restoreGState()
    }

    /// The same raster a fixture frame is built from, encoded losslessly as the reference a decoded
    /// frame is compared against.
    static func referencePNG(index: Int, atUs: Int64, width: Int, height: Int) -> Data {
        let buffer = draw(index: index, atUs: atUs, width: width, height: height)
        let image = CIContext().createCGImage(
            CIImage(cvPixelBuffer: buffer), from: CGRect(x: 0, y: 0, width: width, height: height))!
        let data = NSMutableData()
        let destination = CGImageDestinationCreateWithData(data, "public.png" as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, image, nil)
        precondition(CGImageDestinationFinalize(destination), "Cannot encode reference frame")
        return data as Data
    }
}

enum FixtureWriter {
    /// Writes an H.264 fixture whose frame `i` is presented at `times[i]`.
    static func write(
        to url: URL, times: [CMTime], width: Int = 320, height: Int = 240,
        keyFrameInterval: Int = 15, transform: CGAffineTransform = .identity
    ) async throws {
        try? FileManager.default.removeItem(at: url)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoMaxKeyFrameIntervalKey: keyFrameInterval,
                    AVVideoAverageBitRateKey: 4_000_000,
                ],
            ])
        input.expectsMediaDataInRealTime = false
        input.transform = transform
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input, sourcePixelBufferAttributes: nil)
        guard writer.canAdd(input) else { fatalError("Cannot add fixture writer input") }
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? FixtureError.writeFailed }
        writer.startSession(atSourceTime: .zero)
        for (index, time) in times.enumerated() {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 500_000) }
            let frame = FixtureFrame.draw(
                index: index, atUs: microsecondValue(time), width: width, height: height)
            guard adaptor.append(frame, withPresentationTime: time) else {
                throw writer.error ?? FixtureError.writeFailed
            }
        }
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? FixtureError.writeFailed }
    }

    static func microsecondValue(_ time: CMTime) -> Int64 {
        CMTimeConvertScale(time, timescale: 1_000_000, method: .roundHalfAwayFromZero).value
    }

    enum FixtureError: Error { case writeFailed }
}

/// Every sample presentation timestamp of a fixture, enumerated by decoding the whole file. Tests
/// compare cursor-selected timestamps against this independent ground truth.
enum FixtureTruth {
    static func presentationMicroseconds(of url: URL) async throws -> [Int64] {
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let track = try await asset.loadTracks(withMediaType: .video).first else { return [] }
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output)
        reader.startReading()
        var times: [Int64] = []
        while let sample = output.copyNextSampleBuffer() {
            times.append(FixtureWriter.microsecondValue(CMSampleBufferGetPresentationTimeStamp(sample)))
        }
        return times
    }
}

/// Reads back what a decoded PNG actually shows.
struct FixtureImage {
    let width: Int
    let height: Int
    fileprivate let pixels: [UInt8]

    init(contentsOf url: URL) throws {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else { fatalError("Cannot read image at \(url.path)") }
        let pixelWidth = image.width
        let pixelHeight = image.height
        width = pixelWidth
        height = pixelHeight
        var buffer = [UInt8](repeating: 0, count: pixelWidth * pixelHeight * 4)
        buffer.withUnsafeMutableBytes { raw in
            let context = CGContext(
                data: raw.baseAddress, width: pixelWidth, height: pixelHeight, bitsPerComponent: 8,
                bytesPerRow: pixelWidth * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            context?.draw(image, in: CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
        }
        pixels = buffer
    }

    /// Average color of a top-left-origin rectangle, as 0...1 red, green, blue.
    func color(x: Int, y: Int, width sampleWidth: Int = 6, height sampleHeight: Int = 6)
        -> (red: Double, green: Double, blue: Double)
    {
        var totals = (red: 0.0, green: 0.0, blue: 0.0)
        var counted = 0.0
        for row in y..<min(y + sampleHeight, height) {
            for column in x..<min(x + sampleWidth, width) {
                let offset = (row * width + column) * 4
                totals.red += Double(pixels[offset]) / 255
                totals.green += Double(pixels[offset + 1]) / 255
                totals.blue += Double(pixels[offset + 2]) / 255
                counted += 1
            }
        }
        guard counted > 0 else { return (0, 0, 0) }
        return (totals.red / counted, totals.green / counted, totals.blue / counted)
    }

    /// Mean absolute difference per colour channel, 0...1, against an image of the same size.
    func difference(to other: FixtureImage) -> Double {
        precondition(
            width == other.width && height == other.height, "Compared images must share a size")
        var total = 0.0
        for index in 0..<(width * height * 4) where index % 4 != 3 {
            total += abs(Double(pixels[index]) - Double(other.pixels[index])) / 255
        }
        return total / Double(width * height * 3)
    }

    /// The frame index the picture itself states, read from its binary blocks.
    func statedFrameIndex(offsetX: Int = 0, offsetY: Int = 0) -> Int {
        var index = 0
        for bit in 0..<8 {
            let center = FixtureFrame.blockCenter(bit: bit)
            let sample = color(x: Int(center.x) - offsetX - 3, y: Int(center.y) - offsetY - 3)
            let luma = (sample.red + sample.green + sample.blue) / 3
            if luma > 0.5 { index |= 1 << bit }
        }
        return index
    }
}
