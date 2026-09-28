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
        public let gain: Double
    }
}
