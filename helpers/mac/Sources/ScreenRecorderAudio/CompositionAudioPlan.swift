import Foundation
import CoreMedia
import ScreenRecorderMedia

/// The compiler's audio schedule and child-before-parent processing tree, plus resolved asset
/// locators. This is an execution plan, not another editable project document.
public struct CompositionAudioPlan: Codable, Sendable {
    public let output: String
    public let range: Samples
    public let clips: [Clip]
    public let processing: [CompositionProcessing]
    public let assets: [CompositionAsset]
    public let state: State?
    public let retimeImplementationId: String?

    public init(
        output: String, range: Samples, clips: [Clip], processing: [CompositionProcessing],
        assets: [CompositionAsset], state: State? = nil, retimeImplementationId: String? = nil
    ) {
        self.output = output
        self.range = range
        self.clips = clips
        self.processing = processing
        self.assets = assets
        self.state = state
        self.retimeImplementationId = retimeImplementationId
    }

    public struct Samples: Codable, Sendable, Equatable {
        public let start: Int64
        public let end: Int64
        var valid: Bool { start >= 0 && end > start && end <= TimeSpan.maximumMicroseconds }
    }
    public struct Selection: Codable, Sendable {
        let startUs: ExactTime
        let endUs: ExactTime
        private enum CodingKeys: String, CodingKey { case startUs, endUs }
        public init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            startUs = try values.decode(ExactTime.self, forKey: .startUs)
            endUs = try values.decode(ExactTime.self, forKey: .endUs)
            guard startUs.numerator >= 0, endUs.numerator >= 0 else {
                throw NativeFailure("INVALID_REQUEST", "Selected times must be nonnegative.")
            }
        }
        // Internal physical runs may precede the normalized source origin.
        init(startUs: ExactTime, endUs: ExactTime) {
            self.startUs = startUs
            self.endUs = endUs
        }
    }
    public struct Clip: Codable, Sendable {
        let clipId: String
        let trackId: String
        let sampleRange: Samples
        let placement: Selection
        let source: Source
        let pitch: String
        let available: [Samples]
        let context: [Context]
        let required: [Samples]?
    }
    public struct State: Codable, Sendable {
        let implementationId: String
        let clips: [Clip]
        let processing: [CompositionProcessing]
        let domains: [Domain]
        let formats: [Format]
        struct Domain: Codable, Sendable {
            let sampleRange: Samples
            let dependencies: [Int]
            let members: [Member]
        }
        struct Member: Codable, Sendable {
            let target: CompositionProcessing.Target
            let stepId: String
            let sampleRange: Samples
        }
        struct Format: Codable, Sendable {
            let assetId: String
            let streamId: String
            let channels: Int?
            let sampleRate: Int?
        }
    }
    public struct Context: Codable, Sendable {
        let source: Selection
        let sampleRange: Samples
    }
    public struct Source: Codable, Sendable {
        let kind: String
        let assetId: String?
        let streamId: String?
        let range: Selection?
    }

}

extension CompositionAudioPlan.Selection {
    init(_ span: TimeSpan) {
        self.init(startUs: ExactTime(Int128(span.startUs)), endUs: ExactTime(Int128(span.endUs)))
    }
    func intersection(_ other: Self) throws -> Self? {
        let start = try startUs.subtract(other.startUs).numerator >= 0 ? startUs : other.startUs
        let end = try endUs.subtract(other.endUs).numerator <= 0 ? endUs : other.endUs
        return try end.subtract(start).numerator > 0 ? Self(startUs: start, endUs: end) : nil
    }
    /// Public microsecond evidence is a projection, never the execution clock.
    func roundedSpan() throws -> TimeSpan {
        TimeSpan(startUs: try startUs.sample(1_000_000, nearest: true),
            endUs: try endUs.sample(1_000_000, nearest: true))
    }
}
