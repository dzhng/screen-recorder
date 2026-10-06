import CoreGraphics
import Foundation
import Vision
import YapMedia

/// Requests all faces in the delivered, upright picture. Detection is evidence only.
public struct FaceObservationRequest: Codable, Sendable, Equatable {
    let recipe: String

    func validate() throws {
        guard recipe == "vision-face-rectangles-v1" else {
            throw NativeFailure("INVALID_REQUEST", "Unknown face observation recipe.")
        }
    }
}

public struct FaceObservations: Encodable {
    struct Face: Encodable {
        let id: String
        let boundingBox: Box
        let confidence: Double
    }
    struct Box: Encodable {
        let x: Int
        let y: Int
        let width: Int
        let height: Int
    }
    let recipe = "vision-face-rectangles-v1"
    let coordinateSpace = "delivered-top-left-pixels"
    let width: Int
    let height: Int
    let status: String
    let faces: [Face]
    let reason: String?

    static func detect(_ image: CGImage, request: FaceObservationRequest) throws -> Self {
        try request.validate()
        let width = image.width, height = image.height
        guard width > 0, height > 0, width <= 8192, height <= 8192 else {
            throw NativeFailure("INVALID_RESPONSE", "Delivered picture has invalid face-observation dimensions.")
        }
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        let request = VNDetectFaceRectanglesRequest()
        do {
            try handler.perform([request])
        } catch {
            return Self(width: width, height: height, status: "error", faces: [], reason: String(String(describing: error).prefix(4096)))
        }
        let results = request.results ?? []
        guard results.count <= 64 else {
            return Self(width: width, height: height, status: "error", faces: [], reason: "face_count_exceeds_limit")
        }
        for observation in results {
            let confidence = Double(observation.confidence)
            guard confidence.isFinite, (0...1).contains(confidence) else {
                return Self(width: width, height: height, status: "error", faces: [], reason: "invalid_face_confidence")
            }
        }
        let faces: [Face] = results.sorted {
            if $0.boundingBox.minX != $1.boundingBox.minX { return $0.boundingBox.minX < $1.boundingBox.minX }
            return $0.boundingBox.minY > $1.boundingBox.minY
        }.prefix(64).enumerated().compactMap { index, observation -> Face? in
            let box = observation.boundingBox
            let x = max(0, min(width, Int((box.minX * Double(width)).rounded(.down))))
            let y = max(0, min(height, Int(((1 - box.maxY) * Double(height)).rounded(.down))))
            let right = max(x, min(width, Int((box.maxX * Double(width)).rounded(.up))))
            let bottom = max(y, min(height, Int(((1 - box.minY) * Double(height)).rounded(.up))))
            guard right > x, bottom > y else { return nil }
            return Face(id: "face-\(index)", boundingBox: Box(x: x, y: y, width: right - x, height: bottom - y), confidence: Double(observation.confidence))
        }
        return Self(width: width, height: height, status: faces.isEmpty ? "no_face" : "available", faces: faces, reason: faces.isEmpty ? "no_face" : nil)
    }
}
