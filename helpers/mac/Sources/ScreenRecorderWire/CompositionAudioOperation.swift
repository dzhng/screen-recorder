import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

enum CompositionAudioOperation {
    struct HeldInput: Codable {
        let domainIndex: Int
        let recipe: AudioStateRecipe
        let sampleRange: CompositionAudioPlan.Samples
        let sampleRate: Int
        let channels: Int
        let pcm: RetainedAudioInput
        func open() throws -> CompositionAudio.HeldState {
            guard sampleRate == 48000, channels == 2, pcm.unavailable.isEmpty,
                pcm.frames == sampleRange.end - sampleRange.start, pcm.range.start == 0, pcm.range.end == pcm.frames else {
                throw NativeFailure("INVALID_REQUEST", "Held state must contain the complete declared stereo 48 kHz domain.")
            }
            return CompositionAudio.HeldState(domainIndex: domainIndex, recipe: recipe, sampleRange: sampleRange,
                source: try pcm.open(expected: .init(start: 0, end: pcm.frames)))
        }
    }
    static func held(_ parameters: [String: Any]) throws -> [CompositionAudio.HeldState] {
        struct Inputs: Codable { let held: [HeldInput] }
        guard parameters["held"] != nil else { return [] }
        return try WireRequest.decode(Inputs.self, from: ["held": parameters["held"]!]).held.map { try $0.open() }
    }
    static func prepare(_ params: [String: Any]) async throws -> CompositionAudioDomainResult {
        let parameters = try WireRequest.compositionParameters(params)
        struct Selection: Codable { let domainIndex: Int; let input: String }
        let selection = try WireRequest.decode(Selection.self, from: parameters.filter { ["domainIndex", "input"].contains($0.key) })
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: parameters.filter { !["domainIndex", "input", "held"].contains($0.key) })
        try WireRequest.requireAbsolute(plan.output)
        return try await CompositionAudio.writeDomain(plan, domainIndex: selection.domainIndex, input: selection.input, held: held(parameters))
    }
    static func validate(_ params: [String: Any]) async throws -> [String: String] {
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: WireRequest.compositionParameters(params))
        try WireRequest.requireAbsolute(plan.output)
        try await CompositionAudio.validate(plan)
        return ["retime": CompositionAudio.retimeImplementation, "statePreparation": CompositionAudio.statePreparationImplementation]
    }

    static func execute(_ params: [String: Any]) async throws -> CompositionAudioResult {
        let parameters = try WireRequest.compositionParameters(params)
        let plan = try WireRequest.decode(CompositionAudioPlan.self, from: parameters.filter { !["retained", "held"].contains($0.key) })
        try WireRequest.requireAbsolute(plan.output)
        try CompositionAudio.validateRetimeImplementation(plan.retimeImplementationId)
        if let operand = parameters["retained"] {
            guard parameters["held"] == nil else { throw NativeFailure("INVALID_REQUEST", "Retained output cannot also request state substitution.") }
            guard let retained = operand as? [String: Any] else {
                throw NativeFailure("INVALID_REQUEST", "Retained PCM operand must be an object.")
            }
            return try await WireRequest.decode(RetainedAudioInput.self, from: retained)
                .open(expected: plan.range).write(to: URL(fileURLWithPath: plan.output))
        }
        return try await CompositionAudio.write(plan, held: held(parameters))
    }
}
