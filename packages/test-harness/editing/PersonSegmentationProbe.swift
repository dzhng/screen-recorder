import CoreGraphics
import CoreVideo
import Foundation
import ImageIO
import Vision

private let deliveredWidth = 640.0
private let deliveredHeight = 360.0
private let authoredZone = [280.0, 68.0, 116.0, 164.0]

private struct Row: Encodable {
    let ordinal: Int
    let status: String
    let maskWidth: Int?
    let maskHeight: Int?
    let candidate: [Double]?
    let iou: Double?
}

private func intersectionOverUnion(_ a: [Double], _ b: [Double]) -> Double {
    let overlapWidth = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    let overlapHeight = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    let intersection = overlapWidth * overlapHeight
    return intersection / (a[2] * a[3] + b[2] * b[3] - intersection)
}

private func inspect(_ path: String, ordinal: Int) throws -> Row {
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .accurate
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8
    try handler.perform([request])
    guard let observation = request.results?.first else {
        return Row(ordinal: ordinal, status: "no_mask", maskWidth: nil, maskHeight: nil, candidate: nil, iou: nil)
    }

    let pixelBuffer = observation.pixelBuffer
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    let maskWidth = CVPixelBufferGetWidth(pixelBuffer)
    let maskHeight = CVPixelBufferGetHeight(pixelBuffer)
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
        return Row(ordinal: ordinal, status: "no_base", maskWidth: maskWidth, maskHeight: maskHeight, candidate: nil, iou: nil)
    }

    let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
    let rowBytes = CVPixelBufferGetBytesPerRow(pixelBuffer)
    var minimumX = maskWidth
    var maximumX = -1
    var minimumY = maskHeight
    var maximumY = -1
    for y in 0..<maskHeight {
        for x in 0..<maskWidth where bytes[y * rowBytes + x] >= 128 {
            minimumX = min(minimumX, x)
            maximumX = max(maximumX, x)
            minimumY = min(minimumY, y)
            maximumY = max(maximumY, y)
        }
    }
    guard maximumX >= minimumX, maximumY >= minimumY else {
        return Row(ordinal: ordinal, status: "empty_mask", maskWidth: maskWidth, maskHeight: maskHeight, candidate: nil, iou: nil)
    }

    let scaleX = deliveredWidth / Double(maskWidth)
    let scaleY = deliveredHeight / Double(maskHeight)
    let candidate = [
        Double(minimumX) * scaleX,
        Double(minimumY) * scaleY,
        Double(maximumX - minimumX + 1) * scaleX,
        Double(maximumY - minimumY + 1) * scaleY,
    ]
    return Row(
        ordinal: ordinal,
        status: "available",
        maskWidth: maskWidth,
        maskHeight: maskHeight,
        candidate: candidate,
        iou: intersectionOverUnion(candidate, authoredZone)
    )
}

private var rows: [Row] = []
for (ordinal, path) in CommandLine.arguments.dropFirst().enumerated() {
    rows.append(try inspect(path, ordinal: ordinal))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
print(String(data: try encoder.encode(rows), encoding: .utf8)!)
