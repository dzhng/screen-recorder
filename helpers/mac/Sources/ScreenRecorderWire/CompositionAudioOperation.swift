import Foundation
import ScreenRecorderAudio

enum CompositionAudioOperation {
    static func execute(_ params: [String: Any]) async throws -> CompositionAudioResult {
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: WireRequest.compositionParameters(params))
        try WireRequest.requireAbsolute(plan.output)
        return try await CompositionAudio.write(plan)
    }
}
