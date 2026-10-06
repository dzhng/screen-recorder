import Foundation
import YapMedia

public struct CompositionAudioDomainResult: Encodable, Sendable {
    let audio: CompositionAudioResult
    let domainIndex: Int
    let recipe: AudioStateRecipe
    let sampleRange: CompositionAudioPlan.Samples
    let input: String
    private enum Keys: String, CodingKey { case domainIndex, recipe, sampleRange, input }
    public func encode(to encoder: Encoder) throws {
        try audio.encode(to: encoder)
        var fields = encoder.container(keyedBy: Keys.self)
        try fields.encode(domainIndex, forKey: .domainIndex)
        try fields.encode(recipe, forKey: .recipe)
        try fields.encode(sampleRange, forKey: .sampleRange)
        try fields.encode(input, forKey: .input)
    }
}

extension CompositionAudio {
    /// The compiler selected these member prefixes; no timeline or routing is authored here.
    public static func writeDomain(_ plan: CompositionAudioPlan, domainIndex: Int,
                                   input: String, held: [HeldState]) async throws -> CompositionAudioDomainResult {
        try validateRetimeBinding(plan)
        let sources = Sources()
        guard let resolution = try await resolveState(plan, sources: sources),
            resolution.state.domains.indices.contains(domainIndex), ["program", "detector"].contains(input) else {
            throw invalid("Audio domain preparation requires a declared domain and input prefix.")
        }
        let domain = resolution.state.domains[domainIndex]
        if input == "detector", case .compressor = domain.recipe {} else if input == "detector" {
            throw invalid("Only compressor domains declare detector prefixes.")
        }
        var required = Set<Int>(), pending = domain.dependencies
        while let index = pending.popLast() {
            if required.insert(index).inserted { pending.append(contentsOf: resolution.state.domains[index].dependencies) }
        }
        try prepareRetime(resolution.graph, parent: URL(fileURLWithPath: plan.output).deletingLastPathComponent())
        let prepared = try await prepareState(resolution, output: plan.output, held: held, selected: required)
        let writer = try AudioWaveWriter(sampleRate: rate, frames: domain.sampleRange.end - domain.sampleRange.start,
            channels: 2, output: URL(fileURLWithPath: plan.output), sources: plan.assets.map { URL(fileURLWithPath: $0.path) })
        defer { writer.discard() }
        var received: Int64 = 0, peak = 0.0, clipped: Int64 = 0, maximumBlock = 0
        var maximumPreroll: Int64 = 0, maximumTail: Int64 = 0
        for member in domain.members where member.sampleRange.end > member.sampleRange.start {
            let endpoint = input == "detector" ? member.detector : nil
            let stream = resolution.graph.stream(range: member.sampleRange,
                target: endpoint?.target ?? member.target, before: endpoint == nil ? member.stepId : nil,
                prepared: prepared, reportSourceWork: true, endStepIndex: endpoint?.beforeStepIndex)
            try await stream.consume { block in
                try writer.write(AudioPCMBlock(startFrame: received, frameCount: block.frameCount, samples: block.samples))
                received += Int64(block.frameCount)
            }
            guard let report = stream.report else { throw invalid("Audio domain prefix has no completed receipt.") }
            peak = max(peak, report.peak); clipped += report.clippedSamples; maximumBlock = max(maximumBlock, report.maximumBlockFrames)
            maximumPreroll = max(maximumPreroll, report.decoderContext.maximumPrerollFrames)
            maximumTail = max(maximumTail, report.decoderContext.maximumTailFrames)
        }
        guard received == domain.sampleRange.end - domain.sampleRange.start else { throw invalid("Audio domain prefix changed its authored count.") }
        try Task.checkCancellation()
        let report = CompositionAudioReport(sampleRate: rate, channels: 2, frames: received,
            peak: peak, clippedSamples: clipped, maximumBlockFrames: maximumBlock, peakResidentBytes: ProcessResources.peakResidentBytes(),
            decoderContext: .init(policy: "bounded-current-retained-run", sampleRate: rate,
                maximumPrerollFrames: maximumPreroll, maximumTailFrames: maximumTail),
            sourceWork: sources.report(), unavailable: resolution.graph.missing)
        let audio = CompositionAudioResult(file: plan.output, bytes: try writer.finish(), report: report)
        return CompositionAudioDomainResult(audio: audio, domainIndex: domainIndex, recipe: domain.recipe,
            sampleRange: domain.sampleRange, input: input)
    }
}
