import Foundation

/// Ordered compiler instructions shared by the audio and video execution planes.
public struct CompositionProcessing: Codable, Sendable {
    public let target: Target
    public let mediaKind: String
    public let inputs: [Target]
    public let steps: [Step]
    public struct Target: Codable, Sendable, Hashable {
        public let kind: String
        public let id: String?
        public init(kind: String, id: String? = nil) {
            self.kind = kind
            self.id = id
        }
    }
    public struct Step: Codable, Sendable {
        public let id: String
        public let enabled: Bool
        public let processor: Processor
    }
    public struct Processor: Codable, Sendable {
        public let type: String
        public let gain: SampleScalar?
        public let active: [SampleSpan]?
        public struct SampleSpan: Codable, Sendable {
            public let start: Int64
            public let end: Int64
        }
        public let trailUs: Int64?
        public let crop: Rectangle?
        public let rect: Rectangle?
        public let fit: String?
        public let scale: Point?
        public let rotationDeg: Double?
        public let pivot: Point?
        public struct Point: Codable, Sendable {
            public let x: Double
            public let y: Double
        }
        public struct Rectangle: Codable, Sendable {
            public let x: Double
            public let y: Double
            public let width: Double
            public let height: Double
        }
    }
}
