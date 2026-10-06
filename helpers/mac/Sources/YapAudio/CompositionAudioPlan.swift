import Foundation
import CoreMedia
import YapMedia

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
    public let statePreparationImplementationId: String?

    public init(
        output: String, range: Samples, clips: [Clip], processing: [CompositionProcessing],
        assets: [CompositionAsset], state: State? = nil, retimeImplementationId: String? = nil, statePreparationImplementationId: String? = nil
    ) {
        self.output = output
        self.range = range
        self.clips = clips
        self.processing = processing
        self.assets = assets
        self.state = state
        self.retimeImplementationId = retimeImplementationId
        self.statePreparationImplementationId = statePreparationImplementationId
    }

    public struct Samples: Codable, Sendable, Equatable {
        public let start: Int64
        public let end: Int64
        public init(start: Int64, end: Int64) { self.start = start; self.end = end }
        var valid: Bool { start >= 0 && end > start && end <= TimeSpan.maximumMicroseconds }
    }
    public struct Clip: Codable, Sendable {
        let clipId: String
        let trackId: String
        let sampleRange: Samples
        let placement: ExactRange
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
            let recipe: AudioStateRecipe
            let sampleRange: Samples
            let dependencies: [Int]
            let members: [Member]
        }
        struct Member: Codable, Sendable {
            let target: CompositionProcessing.Target
            let stepId: String
            let detector: DetectorEndpoint?
            let sampleRange: Samples
        }
        struct DetectorEndpoint: Codable, Sendable {
            let target: CompositionProcessing.Target
            let beforeStepIndex: Int
        }
        struct Format: Codable, Sendable {
            let assetId: String
            let streamId: String
            let channels: Int?
            let sampleRate: Int?
        }
    }
    public struct Context: Codable, Sendable {
        let source: ExactRange
        let sampleRange: Samples
    }
    public struct Source: Codable, Sendable {
        let kind: String
        let assetId: String?
        let streamId: String?
        let range: ExactRange?
    }

}
