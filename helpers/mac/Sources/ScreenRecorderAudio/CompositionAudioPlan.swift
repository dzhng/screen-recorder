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

    public init(
        output: String, range: Samples, clips: [Clip], processing: [CompositionProcessing],
        assets: [CompositionAsset]
    ) {
        self.output = output
        self.range = range
        self.clips = clips
        self.processing = processing
        self.assets = assets
    }

    public struct Samples: Codable, Sendable, Equatable {
        public let start: Int64
        public let end: Int64
        var valid: Bool { start >= 0 && end > start && end <= TimeSpan.maximumMicroseconds }
    }
    public struct Selection: Codable, Sendable {
        let startUs: ExactTime
        let endUs: ExactTime
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
