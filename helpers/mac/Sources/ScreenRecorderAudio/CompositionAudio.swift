@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

public struct CompositionAudioReport: Codable, Sendable {
    public let sampleRate: Int
    public let channels: Int
    public let frames: Int64
    public let peak: Double
    public let clippedSamples: Int64
    public let maximumBlockFrames: Int
    public let peakResidentBytes: Int64
    public let decoderContext: DecoderContext
    /// Selected PCM admitted to the rate converter, measured in output-rate frames.
    /// Codec packet lookbehind is discarded by AudioSourceReader before this context.
    public struct DecoderContext: Codable, Sendable {
        let policy: String
        let sampleRate: Int
        let maximumPrerollFrames: Int64
        let maximumTailFrames: Int64
    }
    public let unavailable: [Missing]
    public struct Missing: Codable, Sendable {
        let clipId: String
        let ranges: [CompositionAudioPlan.Samples]
    }
}

public struct CompositionAudioResult: Encodable, Sendable {
    public let file: String
    public let bytes: Int
    let report: CompositionAudioReport
    public func encode(to encoder: Encoder) throws {
        try report.encode(to: encoder)
        var container = encoder.container(keyedBy: Keys.self)
        try container.encode(file, forKey: .file)
        try container.encode(bytes, forKey: .bytes)
    }
    private enum Keys: String, CodingKey { case file, bytes }
}

public enum CompositionAudio {
    fileprivate typealias Plan = CompositionAudioPlan
    private static let rate = 48_000
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    fileprivate struct Context {
        let sourceStart: Int64
        let sourceEnd: Int64
        let project: Plan.Samples
    }
    private static func retainedContexts(
        _ ranges: [Plan.Context], source: SourceTrack,
        offset: ExactTime
    ) throws -> [Context] {
        var result: [Context] = []
        var previous = ExactTime(0)
        for compiled in ranges {
            let range = compiled.source
            guard compiled.sampleRange.valid,
                compiled.sampleRange.start == (try range.startUs.subtract(offset).sample(rate)),
                compiled.sampleRange.end == (try range.endUs.subtract(offset).sample(rate))
            else {
                throw invalid("Context sample bounds disagree with its source/project mapping.")
            }
            guard try range.startUs.subtract(previous).numerator >= 0,
                try range.endUs.subtract(range.startUs).numerator > 0
            else {
                throw invalid("Resampling context must be ordered positive source ranges.")
            }
            previous = range.endUs
            for occupied in source.available {
                let physicalStart = ExactTime(Int128(occupied.startUs))
                let physicalEnd = ExactTime(Int128(occupied.endUs))
                let start =
                    try range.startUs.subtract(physicalStart).numerator >= 0
                    ? range.startUs : physicalStart
                let end =
                    try range.endUs.subtract(physicalEnd).numerator <= 0 ? range.endUs : physicalEnd
                guard try end.subtract(start).numerator > 0 else { continue }
                let rawStart = try start.subtract(ExactTime(Int128(source.sourceOffsetUs)))
                let rawEnd = try end.subtract(ExactTime(Int128(source.sourceOffsetUs)))
                let sourceStart = try rawStart.sample(source.sampleRate, nearest: true)
                let sourceEnd = try rawEnd.sample(source.sampleRate, ceil: true)
                let project = Plan.Samples(
                    start: max(compiled.sampleRange.start, try start.subtract(offset).sample(rate)),
                    end: min(compiled.sampleRange.end, try end.subtract(offset).sample(rate)))
                if sourceEnd > sourceStart, project.end > project.start {
                    result.append(
                        Context(
                            sourceStart: sourceStart, sourceEnd: sourceEnd,
                            project: project))
                }
            }
        }
        return result
    }
    fileprivate final class Input {
        let source: SourceTrack
        let contexts: [Context]
        let intervals: [Plan.Samples]
        var index = 0
        var conversion: ConvertedAudioInterval?
        var maximumPreroll: Int64 = 0
        var maximumTail: Int64 = 0
        init(source: SourceTrack, contexts: [Context], intervals: [Plan.Samples]) {
            self.source = source
            self.contexts = contexts
            self.intervals = intervals
        }
        func mix(into samples: inout [Float], position: Int64, count: Int) throws {
            let end = position + Int64(count)
            while index < intervals.count {
                let interval = intervals[index]
                if interval.end <= position {
                    index += 1
                    conversion = nil
                    continue
                }
                if interval.start >= end { break }
                let first = max(position, interval.start)
                let last = min(end, interval.end)
                if conversion == nil {
                    let desired = first
                    var divisor = source.sampleRate
                    var remainder = rate
                    while remainder != 0 { (divisor, remainder) = (remainder, divisor % remainder) }
                    let inputPeriod = Int64(source.sampleRate / divisor)
                    let outputPeriod = Int64(rate / divisor)
                    guard
                        let contextRange = contexts.first(where: {
                            desired >= $0.project.start && desired < $0.project.end
                        })
                    else {
                        throw NativeFailure.decodeFailed("No retained context at requested sample.")
                    }
                    let segmentStart = contextRange.sourceStart
                    let segmentOutputStart = contextRange.project.start
                    let segmentOutputEnd = contextRange.project.end
                    // Phase is fixed by the compiler's retained run, not a preview window or
                    // clip identity. Converter input never crosses this selected/available run.
                    let context: Int64 = source.sampleRate == rate ? 0 : 1024
                    let periods = max(0, (desired - segmentOutputStart - context) / outputPeriod)
                    let startSample = segmentStart + periods * inputPeriod
                    let outputStart = segmentOutputStart + periods * outputPeriod
                    let skip = desired - outputStart
                    let owed = min(
                        segmentOutputEnd - outputStart, skip + interval.end - first + context)
                    maximumPreroll = max(maximumPreroll, skip)
                    maximumTail = max(maximumTail, max(0, owed - skip - interval.end + first))
                    conversion = try ConvertedAudioInterval(
                        source: source, decoder: AudioSourceReader(source: source),
                        start: CMTime(
                            value: startSample, timescale: CMTimeScale(source.sampleRate)),
                        outputRate: rate, owed: owed,
                        end: CMTime(
                            value: contextRange.sourceEnd, timescale: CMTimeScale(source.sampleRate)
                        ))
                    var remaining = skip
                    while remaining > 0 {
                        try Task.checkCancellation()
                        let count = Int(min(remaining, 8192))
                        var discarded = [Float](repeating: 0, count: count)
                        try conversion!.mix(
                            into: &discarded, at: 0, frames: count, gain: 1, channelMap: [0])
                        remaining -= Int64(count)
                    }
                }
                try conversion!.mix(
                    into: &samples, at: Int(first - position), frames: Int(last - first),
                    gain: 1, channelMap: source.channels == 1 ? [0, 0] : [0, 1])
                if interval.end <= end {
                    index += 1
                    conversion = nil
                } else {
                    break
                }
            }
        }
    }

    public static func open(_ plan: CompositionAudioPlan) async throws -> Stream {
        guard plan.range.valid, plan.clips.count <= 256, !plan.processing.isEmpty,
            plan.processing.count <= 10_000, plan.assets.count <= 256,
            plan.clips.reduce(0, { $0 + $1.available.count + $1.context.count }) <= 20_000
        else {
            throw invalid("Audio plan exceeds bounds or has an empty range/tree.")
        }
        let clipById = Dictionary(grouping: plan.clips, by: \.clipId)
        guard clipById.values.allSatisfy({ $0.count == 1 }), !clipById.keys.contains("") else {
            throw invalid("Audio clip identities must be unique and nonempty.")
        }
        // Video branches remain compiler-owned but contribute no PCM to an output tap.
        let nodes = plan.processing.filter { $0.mediaKind != "video" }
        guard !nodes.isEmpty else {
            throw invalid("Audio execution requires an audio or output tap.")
        }
        let allTargets = Set(plan.processing.map(\.target))
        guard allTargets.count == plan.processing.count,
            plan.processing.allSatisfy({ node in node.inputs.allSatisfy { allTargets.contains($0) }
            })
        else {
            throw invalid("Processing inputs must name unique known targets.")
        }
        let audioTargets = Set(nodes.map(\.target))
        var seen = Set<CompositionProcessing.Target>()
        var used = Set<CompositionProcessing.Target>()
        var stepIds = Set<String>()
        for node in nodes {
            guard ["audio", "output"].contains(node.mediaKind),
                ["clip", "track", "group", "output"].contains(node.target.kind),
                node.target.kind == "output"
                    ? node.target.id == nil : !(node.target.id ?? "").isEmpty,
                seen.insert(node.target).inserted
            else { throw invalid("Invalid processing target.") }
            let inputs = node.inputs.filter { audioTargets.contains($0) }
            guard node.target.kind != "clip" || inputs.isEmpty else {
                throw invalid("Clip processing cannot have inputs.")
            }
            for input in inputs {
                guard input != node.target, seen.contains(input), used.insert(input).inserted else {
                    throw invalid(
                        "Processing must be a child-before-parent tree without shared inputs.")
                }
            }
            for step in node.steps {
                if node.mediaKind == "output",
                    ["geometry", "opacity"].contains(step.processor.type)
                {
                    continue
                }
                guard !step.id.isEmpty, stepIds.insert(step.id).inserted,
                    step.processor.type == "gain", let gain = step.processor.gain, gain.isFinite,
                    gain >= 0, gain <= Double(Float.greatestFiniteMagnitude)
                else { throw invalid("Only finite nonnegative float gain is supported.") }
            }
        }
        guard used.count == nodes.count - 1,
            Set(nodes.filter { $0.target.kind == "clip" }.compactMap { $0.target.id })
                == Set(clipById.keys)
        else { throw invalid("Every audio clip and node must belong to the requested tree.") }
        let assets = Dictionary(grouping: plan.assets, by: { [$0.assetId, $0.streamId] })
        guard assets.values.allSatisfy({ $0.count == 1 }) else {
            throw invalid("Duplicate asset stream.")
        }
        var inputs: [String: Input] = [:]
        var opened: [[String]: SourceTrack] = [:]
        var missing: [CompositionAudioReport.Missing] = []
        for clip in plan.clips {
            try Task.checkCancellation()
            guard clip.sampleRange.valid, clip.sampleRange.start >= plan.range.start,
                clip.sampleRange.end <= plan.range.end, ["preserve", "follow"].contains(clip.pitch)
            else { throw invalid("Invalid compiled clip sample bounds or pitch policy.") }
            guard clip.sampleRange.start >= (try clip.placement.startUs.sample(rate)),
                clip.sampleRange.end <= (try clip.placement.endUs.sample(rate)),
                nodes.contains(where: {
                    $0.target.kind == "track" && $0.target.id == clip.trackId
                        && $0.inputs.contains(.init(kind: "clip", id: clip.clipId))
                })
                    || (nodes.last?.target == .init(kind: "clip", id: clip.clipId))
            else {
                throw invalid("Clip bounds or track do not match the compiled placement/tree.")
            }
            var previous = clip.sampleRange.start
            for part in clip.available {
                guard part.valid, part.start >= previous, part.end <= clip.sampleRange.end else {
                    throw invalid("Availability must be ordered within clip sample bounds.")
                }
                previous = part.end
            }
            if clip.source.kind == "silence" {
                guard clip.source.assetId == nil, clip.source.streamId == nil,
                    clip.source.range == nil, clip.context.isEmpty
                else {
                    throw invalid("Authored silence has no media identity.")
                }
                continue
            }
            guard clip.source.kind == "range", let assetId = clip.source.assetId,
                let streamId = clip.source.streamId, let range = clip.source.range,
                let asset = assets[[assetId, streamId]]?.first,
                asset.path.hasPrefix("/"), !asset.path.contains("\0"),
                asset.originUs >= -TimeSpan.maximumMicroseconds,
                asset.originUs <= TimeSpan.maximumMicroseconds
            else {
                throw invalid("A range clip requires its resolved absolute asset stream.")
            }
            let duration = try range.endUs.subtract(range.startUs)
            let placementDuration = try clip.placement.endUs.subtract(clip.placement.startUs)
            guard duration.numerator > 0, placementDuration.numerator > 0 else {
                throw invalid("Source and placement ranges must be positive.")
            }
            guard duration.equals(placementDuration) else {
                throw NativeFailure("NOT_READY", "Rate-changing audio requires prepared retiming.")
            }
            let offset = try range.startUs.subtract(clip.placement.startUs)
            let source: SourceTrack
            if let existing = opened[[assetId, streamId]] {
                source = existing
            } else {
                source = try await SourceTrack.open(
                    source: asset.path, streamId: streamId,
                    sourceOffsetUs: -asset.originUs,
                    available: [TimeSpan(startUs: 0, endUs: TimeSpan.maximumMicroseconds)])
                opened[[assetId, streamId]] = source
            }
            guard source.channels <= 2 else {
                throw NativeFailure(
                    "UNSUPPORTED_FORMAT", "Audio needs an explicit map for more than two channels.")
            }
            let contexts = try retainedContexts(clip.context, source: source, offset: offset)
            let occupied = contexts.map(\.project)
            var readable: [Plan.Samples] = []
            var cursor = 0
            for available in clip.available {
                while cursor < occupied.count && occupied[cursor].end <= available.start {
                    cursor += 1
                }
                var index = cursor
                while index < occupied.count && occupied[index].start < available.end {
                    let first = max(available.start, occupied[index].start)
                    let last = min(available.end, occupied[index].end)
                    if first < last { readable.append(.init(start: first, end: last)) }
                    index += 1
                }
            }
            var absent: [Plan.Samples] = []
            var position = clip.sampleRange.start
            for part in readable {
                if position < part.start { absent.append(.init(start: position, end: part.start)) }
                position = part.end
            }
            if position < clip.sampleRange.end {
                absent.append(.init(start: position, end: clip.sampleRange.end))
            }
            missing.append(.init(clipId: clip.clipId, ranges: absent))
            inputs[clip.clipId] = Input(
                source: source, contexts: contexts, intervals: readable)
        }
        return Stream(range: plan.range, nodes: nodes, inputs: inputs, missing: missing)
    }

    /// Prepares one bounded PCM source; neither the consumer nor a preview window owns its phase.
    public final class Stream: AudioPCMSource {
        public let format = AudioPCMFormat(sampleRate: rate, channels: 2, layout: .stereo)
        public private(set) var report: CompositionAudioReport?
        private let range: Plan.Samples
        private let nodes: [CompositionProcessing]
        private let inputs: [String: Input]
        private let missing: [CompositionAudioReport.Missing]
        private var consumed = false

        fileprivate init(
            range: Plan.Samples, nodes: [CompositionProcessing], inputs: [String: Input],
            missing: [CompositionAudioReport.Missing]
        ) {
            self.range = range
            self.nodes = nodes
            self.inputs = inputs
            self.missing = missing
        }
        public func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws {
            guard !consumed else { throw invalid("Composition PCM can only be consumed once.") }
            consumed = true
            let audioTargets = Set(nodes.map(\.target))
            // Processing buffers total at most eight MiB, independently of project duration or depth.
            let blockFrames = max(1, min(8192, 1_048_576 / nodes.count))
            var peak: Float = 0
            var clipped: Int64 = 0
            do {
                var position = range.start
                while position < range.end {
                    try Task.checkCancellation()
                    let count = Int(min(Int64(blockFrames), range.end - position))
                    var buffers: [CompositionProcessing.Target: [Float]] = [:]
                    for node in nodes {
                        try Task.checkCancellation()
                        var samples: [Float]
                        if node.target.kind == "clip", let id = node.target.id {
                            guard let input = inputs[id], input.intervals.last?.end ?? 0 > position,
                                input.intervals.first?.start ?? Int64.max < position + Int64(count)
                            else { continue }
                            samples = [Float](repeating: 0, count: count * 2)
                            try input.mix(into: &samples, position: position, count: count)
                        } else {
                            var combined: [Float]?
                            for child in node.inputs where audioTargets.contains(child) {
                                guard let input = buffers.removeValue(forKey: child) else {
                                    continue
                                }
                                if combined == nil {
                                    combined = input
                                } else {
                                    for index in input.indices { combined![index] += input[index] }
                                }
                            }
                            guard let value = combined else { continue }
                            samples = value
                        }
                        for step in node.steps where step.enabled && step.processor.type == "gain" {
                            let gain = Float(step.processor.gain!)
                            for index in samples.indices { samples[index] *= gain }
                        }
                        buffers[node.target] = samples
                    }
                    let samples =
                        buffers[nodes.last!.target] ?? [Float](repeating: 0, count: count * 2)
                    var sampleIndex = 0
                    while sampleIndex < samples.count {
                        let sample = samples[sampleIndex]
                        guard sample.isFinite else {
                            throw NativeFailure(
                                "INVALID_AUDIO", "Processing produced nonfinite PCM.")
                        }
                        peak = max(peak, abs(sample))
                        if abs(sample) > 1 { clipped += 1 }
                        sampleIndex += 1
                    }
                    try await sink(
                        AudioPCMBlock(
                            startFrame: position - range.start, frameCount: count, samples: samples)
                    )
                    position += Int64(count)
                }
            }
            try Task.checkCancellation()
            report = CompositionAudioReport(
                sampleRate: rate, channels: 2,
                frames: range.end - range.start, peak: Double(peak), clippedSamples: clipped,
                maximumBlockFrames: blockFrames,
                peakResidentBytes: ProcessResources.peakResidentBytes(),
                decoderContext: .init(
                    policy: "bounded-current-retained-run", sampleRate: rate,
                    maximumPrerollFrames: inputs.values.map(\.maximumPreroll).max() ?? 0,
                    maximumTailFrames: inputs.values.map(\.maximumTail).max() ?? 0),
                unavailable: missing)
        }
    }

    public static func write(_ plan: CompositionAudioPlan) async throws -> CompositionAudioResult {
        let stream = try await open(plan)
        let writer = try AudioWaveWriter(
            sampleRate: rate, frames: plan.range.end - plan.range.start, channels: 2,
            output: URL(fileURLWithPath: plan.output),
            sources: plan.assets.map { URL(fileURLWithPath: $0.path) })
        defer { writer.discard() }
        try await stream.consume { try writer.write($0) }
        try Task.checkCancellation()
        let bytes = try writer.finish()
        return CompositionAudioResult(file: plan.output, bytes: bytes, report: stream.report!)
    }
}
