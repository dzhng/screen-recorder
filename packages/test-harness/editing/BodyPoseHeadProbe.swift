import CoreGraphics
import Foundation
import ImageIO
import Vision

private let width = 640.0
private let height = 360.0
private let authoredZone = [280.0, 68.0, 116.0, 164.0]
private let jointNames: [(String, VNHumanBodyPoseObservation.JointName)] = [
    ("nose", .nose),
    ("left_eye", .leftEye),
    ("right_eye", .rightEye),
    ("left_ear", .leftEar),
    ("right_ear", .rightEar),
    ("neck", .neck),
]

private struct Joint: Encodable {
    let name: String
    let x: Double
    let y: Double
    let confidence: Double
}

private struct Row: Encodable {
    let ordinal: Int
    let status: String
    let joints: [Joint]
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
    let request = VNDetectHumanBodyPoseRequest()
    try handler.perform([request])
    guard let body = request.results?.first else {
        return Row(ordinal: ordinal, status: "no_body", joints: [], candidate: nil, iou: nil)
    }

    var joints: [Joint] = []
    for (name, jointName) in jointNames {
        guard let point = try? body.recognizedPoint(jointName), point.confidence > 0 else { continue }
        joints.append(Joint(name: name, x: Double(point.location.x), y: Double(point.location.y), confidence: Double(point.confidence)))
    }
    guard !joints.isEmpty else {
        return Row(ordinal: ordinal, status: "no_head_joints", joints: [], candidate: nil, iou: nil)
    }

    let xs = joints.map { $0.x * width }
    let ys = joints.map { (1 - $0.y) * height }
    let minimumX = xs.min()!
    let maximumX = xs.max()!
    let minimumY = ys.min()!
    let maximumY = ys.max()!
    let candidate = [minimumX, minimumY, maximumX - minimumX, maximumY - minimumY]
    return Row(
        ordinal: ordinal,
        status: "available",
        joints: joints,
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
