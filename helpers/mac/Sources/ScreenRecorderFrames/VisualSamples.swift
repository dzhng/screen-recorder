import Foundation

/// Clean, top-left row-major sRGB RGB8 pixels. No cursor or scene policy enters this evidence.
public struct VisualSample: Encodable, Sendable {
    public let requestedSourceUs: Int64
    public let actualSourceUs: Int64
    public let distanceUs: Int64
    public let width: Int
    public let height: Int
    public let rgbBase64: String
}

public struct VisualSamples: Encodable, Sendable {
    public let sourceWidth: Int
    public let sourceHeight: Int
    public let samples: [VisualSample]
}
