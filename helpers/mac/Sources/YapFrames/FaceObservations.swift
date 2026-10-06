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
        let faces = (request.results ?? []).sorted {
            if $0.boundingBox.minX != $1.boundingBox.minX { return $0.boundingBox.minX < $1.boundingBox.minX }
            return $0.boundingBox.minY > $1.boundingBox.minY
        }.enumerated().map { index, observation in
            let box = observation.boundingBox
            let x = max(0, min(width, Int((box.minX * Double(width)).rounded(.down))))
            let y = max(0, min(height, Int(((1 - box.maxY) * Double(height)).rounded(.down))))
            let right = max(x, min(width, Int((box.maxX * Double(width)).rounded(.up))))
            let bottom = max(y, min(height, Int(((1 - box.minY) * Double(height)).rounded(.up))))
            guard right > x, bottom > y else { return nil }
            return Face(id: "face-\(index)", boundingBox: Box(x: x, y: y, width: right - x, height: bottom - y), confidence: min(1, max(0, Double(observation.confidence))))
        }.compactMap { $0 }
        return Self(width: width, height: height, status: faces.isEmpty ? "no_face" : "available", faces: faces, reason: faces.isEmpty ? "no_face" : nil)
    }
}
