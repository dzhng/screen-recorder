import Foundation

/// A complete static state recipe. RNNoise mix remains a compiled scalar on each member.
public enum AudioStateRecipe: Codable, Sendable, Equatable {
    case rnnoise
    case normalization(Normalization)
    case limiter(Limiter)
    case compressor(Compressor)

    public struct Normalization: Codable, Sendable, Equatable {
        public let type: String
        public let mode: String
        public let targetIntegratedLufs: Double
        public let truePeakCeilingDbtp: Double
        public let maxLoudnessRangeLu: Double
    }
    public struct Limiter: Codable, Sendable, Equatable {
        public let type: String
        public let ceilingDbfs: Double
        public let lookaheadMs: Double
        public let releaseMs: Double
    }
    public struct Compressor: Codable, Sendable, Equatable {
        public let type: String
        public let thresholdDbfs: Double
        public let ratio: Double
        public let kneeDb: Double
        public let attackMs: Double
        public let releaseMs: Double
        public let detector: Detector
        public let makeupGainDb: Double?
        public struct Detector: Codable, Sendable, Equatable {
            public let kind: String
            public let tap: Tap?
            public let beforeStepIndex: Int?
        }
    }
    public struct Tap: Codable, Sendable, Equatable {
        public let target: CompositionProcessing.Target
        public let point: Point
        public struct Point: Codable, Sendable, Equatable {
            public let kind: String
            public let stepId: String?
        }
    }
    private enum CodingKeys: String, CodingKey { case type }
    public static func supports(_ type: String) -> Bool {
        ["rnnoise", "normalization", "limiter", "compressor"].contains(type)
    }
    public init(from decoder: Decoder) throws {
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        switch try fields.decode(String.self, forKey: .type) {
        case "rnnoise": self = .rnnoise
        case "normalization": self = .normalization(try Normalization(from: decoder))
        case "limiter": self = .limiter(try Limiter(from: decoder))
        case "compressor": self = .compressor(try Compressor(from: decoder))
        default: throw DecodingError.dataCorruptedError(forKey: .type, in: fields, debugDescription: "Unknown state recipe.")
        }
    }
    public func encode(to encoder: Encoder) throws {
        switch self {
        case .rnnoise:
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encode("rnnoise", forKey: .type)
        case .normalization(let recipe): try recipe.encode(to: encoder)
        case .limiter(let recipe): try recipe.encode(to: encoder)
        case .compressor(let recipe): try recipe.encode(to: encoder)
        }
    }
    public func matches(_ recipe: AudioStateRecipe, memberTarget: CompositionProcessing.Target,
                        detectorTarget: CompositionProcessing.Target?, beforeStepIndex: Int?) -> Bool {
        guard case .compressor(let expected) = self, expected.detector.kind == "member" else { return self == recipe }
        guard case .compressor(let actual) = recipe, actual.detector.kind == "tap",
            actual.detector.tap?.target == memberTarget, detectorTarget == memberTarget,
            beforeStepIndex == expected.detector.beforeStepIndex else { return false }
        return expected.type == actual.type && expected.thresholdDbfs == actual.thresholdDbfs && expected.ratio == actual.ratio
            && expected.kneeDb == actual.kneeDb && expected.attackMs == actual.attackMs && expected.releaseMs == actual.releaseMs
            && expected.makeupGainDb == actual.makeupGainDb
    }
    public func validate() throws {
        func bounded(_ value: Double, _ minimum: Double, _ maximum: Double) -> Bool {
            value.isFinite && value >= minimum && value <= maximum
        }
        let valid: Bool
        switch self {
        case .rnnoise: valid = true
        case .normalization(let r):
            valid = ["gain-only", "dynamic"].contains(r.mode) && bounded(r.targetIntegratedLufs, -70, -5)
                && bounded(r.truePeakCeilingDbtp, -9, 0) && bounded(r.maxLoudnessRangeLu, 1, 50)
        case .limiter(let r):
            valid = bounded(r.ceilingDbfs, 20 * log10(0.0625), 0)
                && bounded(r.lookaheadMs, 0.1, 80) && bounded(r.releaseMs, 1, 8000)
        case .compressor(let r):
            let detector = r.detector
            var endpoint = detector.kind == "input" && detector.tap == nil && detector.beforeStepIndex == nil
            if detector.kind == "member" { endpoint = detector.tap == nil && (detector.beforeStepIndex ?? -1) >= 0 }
            if detector.kind == "tap", detector.beforeStepIndex == nil, let tap = detector.tap {
                endpoint = ["clip", "track", "group", "output"].contains(tap.target.kind)
                    && (tap.target.kind == "output" ? tap.target.id == nil : !(tap.target.id ?? "").isEmpty)
                    && (["dry", "processed"].contains(tap.point.kind) && tap.point.stepId == nil
                        || tap.point.kind == "after-step" && !(tap.point.stepId ?? "").isEmpty)
            }
            valid = bounded(r.thresholdDbfs, 20 * log10(0.000976563), 0) && bounded(r.ratio, 1, 20)
                && bounded(r.kneeDb, 0, 20 * log10(8)) && bounded(r.attackMs, 0.01, 2000)
                && bounded(r.releaseMs, 0.01, 9000) && bounded(r.makeupGainDb ?? 0, 0, 20 * log10(64)) && endpoint
        }
        guard valid else { throw NativeFailure("INVALID_REQUEST", "State recipe parameters are outside the typed contract.") }
    }
}
