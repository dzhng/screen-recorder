import Foundation
import ScreenRecorderFrames

// The core resolves revisions and allocates derivative paths before calling this worker.
enum FrameOperation {
    private struct Parameters: Decodable {
        let source: String
        let output: String
        let atSourceUs: Int64
        let kept: FrameInterval
        let crop: FrameCrop?
        let overlay: FrameOverlay?
        let maxLongEdge: Int?
        let maxEncodedBytes: Int?
    }

    static func execute(_ params: [String: Any]) async throws -> DecodedFrame {
        let required: Set<String> = ["source", "output", "atSourceUs", "kept"]
        let optional: Set<String> = ["crop", "overlay", "maxLongEdge", "maxEncodedBytes"]
        guard required.isSubset(of: Set(params.keys)),
            Set(params.keys).isSubset(of: required.union(optional)),
            let kept = params["kept"] as? [String: Any],
            Set(kept.keys) == ["startUs", "endUs"]
        else { throw FrameFailure("INVALID_REQUEST", "Invalid media.frame parameters.") }
        if let crop = params["crop"], !(crop is NSNull) {
            guard let fields = crop as? [String: Any],
                Set(fields.keys) == ["x", "y", "width", "height"]
            else { throw FrameFailure("INVALID_REQUEST", "Invalid frame crop fields.") }
        }
        if let overlay = params["overlay"], !(overlay is NSNull) {
            try validateOverlayFields(overlay)
        }
        let parameters: Parameters
        do {
            parameters = try JSONDecoder().decode(
                Parameters.self, from: JSONSerialization.data(withJSONObject: params))
        } catch {
            throw FrameFailure("INVALID_REQUEST", "Invalid media.frame parameter types.")
        }
        guard parameters.source.hasPrefix("/"), parameters.output.hasPrefix("/") else {
            throw FrameFailure("INVALID_REQUEST", "Frame paths must be absolute.")
        }
        let source = try await FrameSource(url: URL(fileURLWithPath: parameters.source))
        return try await source.decodeFrame(
            FrameRequest(
                atSourceUs: parameters.atSourceUs, kept: parameters.kept,
                output: URL(fileURLWithPath: parameters.output), overlay: parameters.overlay,
                crop: parameters.crop,
                maxLongEdge: parameters.maxLongEdge ?? FrameLimits.defaultLongEdge,
                maxEncodedBytes: parameters.maxEncodedBytes ?? FrameLimits.maximumEncodedBytes))
    }

    /// Requests are parsed strictly: an unknown or missing overlay field is a caller mistake, not a
    /// field to ignore. Point values themselves are the decoder's to validate against real media.
    private static func validateOverlayFields(_ value: Any) throws {
        guard let overlay = value as? [String: Any],
            Set(["trail", "trailUs"]).isSubset(of: Set(overlay.keys)),
            Set(overlay.keys).isSubset(of: ["trail", "trailUs", "pointer"]),
            let runs = overlay["trail"] as? [Any]
        else { throw FrameFailure("INVALID_REQUEST", "Invalid frame overlay fields.") }
        var points: [Any] = []
        if let pointer = overlay["pointer"], !(pointer is NSNull) { points.append(pointer) }
        for run in runs {
            guard let run = run as? [Any] else {
                throw FrameFailure("INVALID_REQUEST", "Each frame overlay trail run must be a list.")
            }
            points.append(contentsOf: run)
        }
        for point in points {
            guard let fields = point as? [String: Any],
                Set(fields.keys) == ["atSourceUs", "x", "y"]
            else { throw FrameFailure("INVALID_REQUEST", "Invalid cursor point fields.") }
        }
    }
}
