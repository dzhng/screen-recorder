import CoreGraphics
import Foundation
import ImageIO
import Vision

private let width = 640.0
private let height = 360.0
private let authoredZone = [280.0, 68.0, 116.0, 164.0]

private struct Row: Encodable {
    let ordinal: Int
    let detector: [Double]
    let contour: [Double]?
    let candidate: [Double]?
    let confidence: Double?
    let iou: Double?
}

private func intersectionOverUnion(_ a: [Double], _ b: [Double]) -> Double {
    let overlapWidth = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    let overlapHeight = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    let intersection = overlapWidth * overlapHeight
    return intersection / (a[2] * a[3] + b[2] * b[3] - intersection)
}

private func bounded(_ value: Double, _ limit: Double) -> Double {
    max(0, min(limit, value))
}

private func inspect(_ path: String, ordinal: Int) throws -> Row {
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil)!
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    let faceRequest = VNDetectFaceRectanglesRequest()
    try handler.perform([faceRequest])
    guard let face = faceRequest.results?.first else {
        return Row(ordinal: ordinal, detector: [], contour: nil, candidate: nil, confidence: nil, iou: nil)
    }

    let box = face.boundingBox
    // Convert Vision's normalized, lower-left rectangle to delivered pixels.
    let detector = [
        Double(box.origin.x) * width,
        (1 - Double(box.origin.y) - Double(box.height)) * height,
        Double(box.width) * width,
        Double(box.height) * height,
    ]

    let landmarkRequest = VNDetectFaceLandmarksRequest()
    landmarkRequest.inputFaceObservations = [face]
    try handler.perform([landmarkRequest])
    guard let landmarks = landmarkRequest.results?.first?.landmarks,
          let contour = landmarks.faceContour else {
        return Row(ordinal: ordinal, detector: detector, contour: nil, candidate: nil,
                   confidence: Double(face.confidence), iou: nil)
    }

    let points = (0..<contour.pointCount).map { contour.normalizedPoints[$0] }
    let minimumX = points.map { Double($0.x) }.min()!
    let maximumX = points.map { Double($0.x) }.max()!
    let minimumY = points.map { Double($0.y) }.min()!
    let maximumY = points.map { Double($0.y) }.max()!

    // Landmark points are normalized in the detector rectangle and use y-up.
    // Their envelope is a separate visible-face candidate, never a replacement
    // detector box or an authorization to expand one in production.
    let raw = [
        detector[0] + minimumX * detector[2],
        detector[1] + (1 - maximumY) * detector[3],
        (maximumX - minimumX) * detector[2],
        (maximumY - minimumY) * detector[3],
    ]
    let left = bounded(raw[0], width)
    let top = bounded(raw[1], height)
    let right = bounded(raw[0] + raw[2], width)
    let bottom = bounded(raw[1] + raw[3], height)
    let candidate = [left, top, right - left, bottom - top]

    return Row(ordinal: ordinal, detector: detector,
               contour: [minimumX, minimumY, maximumX, maximumY], candidate: candidate,
               confidence: Double(face.confidence), iou: intersectionOverUnion(candidate, authoredZone))
}

private var rows: [Row] = []
for (ordinal, path) in CommandLine.arguments.dropFirst().enumerated() {
    rows.append(try inspect(path, ordinal: ordinal))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
print(String(data: try encoder.encode(rows), encoding: .utf8)!)
