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
        public let stateRecipe: AudioStateRecipe?
        private enum CodingKeys: String, CodingKey { case type, gain, mix, active, trailUs, crop, rect, fit, scale, rotationDeg, pivot }
        public init(from decoder: Decoder) throws {
            let fields = try decoder.container(keyedBy: CodingKeys.self)
            type = try fields.decode(String.self, forKey: .type)
            gain = try fields.decodeIfPresent(SampleScalar.self, forKey: .gain)
            mix = try fields.decodeIfPresent(SampleScalar.self, forKey: .mix)
            active = try fields.decodeIfPresent([SampleSpan].self, forKey: .active)
            trailUs = try fields.decodeIfPresent(Int64.self, forKey: .trailUs)
            crop = try fields.decodeIfPresent(Rectangle.self, forKey: .crop)
            rect = try fields.decodeIfPresent(Rectangle.self, forKey: .rect)
            fit = try fields.decodeIfPresent(String.self, forKey: .fit)
            scale = try fields.decodeIfPresent(Point.self, forKey: .scale)
            rotationDeg = try fields.decodeIfPresent(Double.self, forKey: .rotationDeg)
            pivot = try fields.decodeIfPresent(Point.self, forKey: .pivot)
            stateRecipe = AudioStateRecipe.supports(type) ? try AudioStateRecipe(from: decoder) : nil
        }
        public func encode(to encoder: Encoder) throws {
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode(type, forKey: .type)
            try fields.encodeIfPresent(gain, forKey: .gain)
            try fields.encodeIfPresent(mix, forKey: .mix)
            try fields.encodeIfPresent(active, forKey: .active)
            try fields.encodeIfPresent(trailUs, forKey: .trailUs)
            try fields.encodeIfPresent(crop, forKey: .crop)
            try fields.encodeIfPresent(rect, forKey: .rect)
            try fields.encodeIfPresent(fit, forKey: .fit)
            try fields.encodeIfPresent(scale, forKey: .scale)
            try fields.encodeIfPresent(rotationDeg, forKey: .rotationDeg)
            try fields.encodeIfPresent(pivot, forKey: .pivot)
            try stateRecipe?.encode(to: encoder)
        }
        public let gain: SampleScalar?
        public let mix: SampleScalar?
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
