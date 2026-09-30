import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

enum CompositionAudioOperation {
    static func validate(_ params: [String: Any]) async throws -> [String: String] {
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: WireRequest.compositionParameters(params))
        try WireRequest.requireAbsolute(plan.output)
        try await CompositionAudio.validate(plan)
        return ["retime": CompositionAudio.retimeImplementation]
    }

    static func execute(_ params: [String: Any]) async throws -> CompositionAudioResult {
        let parameters = try WireRequest.compositionParameters(params)
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: parameters.filter { $0.key != "retained" })
        try WireRequest.requireAbsolute(plan.output)
        try CompositionAudio.validateRetimeImplementation(plan.retimeImplementationId)
        if let operand = parameters["retained"] {
            guard let retained = operand as? [String: Any] else {
                throw NativeFailure("INVALID_REQUEST", "Retained PCM operand must be an object.")
            }
            return try await WireRequest.decode(RetainedAudioInput.self, from: retained)
                .open(expected: plan.range).write(to: URL(fileURLWithPath: plan.output))
        }
        return try await CompositionAudio.write(plan)
    }
}
