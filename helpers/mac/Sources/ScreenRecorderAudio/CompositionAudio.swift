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
    typealias Plan = CompositionAudioPlan
    static let rate = 48_000
    static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    struct Context {
        let origin: ExactTime
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
                let physicalStart = occupied.support.startUs
                let physicalEnd = occupied.support.endUs
                let start =
                    try range.startUs.subtract(physicalStart).numerator >= 0
                    ? range.startUs : physicalStart
                let end =
                    try range.endUs.subtract(physicalEnd).numerator <= 0 ? range.endUs : physicalEnd
                guard try end.subtract(start).numerator > 0 else { continue }
                let rawStart = try start.subtract(ExactTime(Int128(source.sourceOffsetUs)))
                let rawEnd = try end.subtract(ExactTime(Int128(source.sourceOffsetUs)))
                let sourceStart = try rawStart.subtract(occupied.nativeOrigin).sample(source.sampleRate, nearest: true)
                let sourceEnd = try rawEnd.subtract(occupied.nativeOrigin).sample(source.sampleRate, ceil: true)
                let project = Plan.Samples(
                    start: max(compiled.sampleRange.start, try start.subtract(offset).sample(rate)),
                    end: min(compiled.sampleRange.end, try end.subtract(offset).sample(rate)))
                if sourceEnd > sourceStart, project.end > project.start {
                    result.append(
                        Context(
                            origin: occupied.nativeOrigin, sourceStart: sourceStart, sourceEnd: sourceEnd,
                            project: project))
                }
            }
        }
        return result
    }
    final class Input {
        let source: SourceTrack
        let contexts: [Context]
        let intervals: [Plan.Samples]
        var index = 0
        var conversion: ConvertedAudioInterval?
        var nextPosition: Int64?
        var maximumPreroll: Int64 = 0
        var maximumTail: Int64 = 0
        init(source: SourceTrack, contexts: [Context], intervals: [Plan.Samples]) {
            self.source = source
            self.contexts = contexts
            self.intervals = intervals
        }
        func mix(into samples: inout [Float], position: Int64, count: Int) throws {
            let end = position + Int64(count)
            if nextPosition != position { conversion = nil }
            nextPosition = end
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
                        source: source, decoder: AudioSourceReader(input: source.input, asset: source.asset, track: source.track,
                            sampleRate: source.sampleRate, packetFrames: source.packetFrames, channels: source.channels),
                        origin: contextRange.origin, start: startSample,
                        outputRate: rate, owed: owed, end: contextRange.sourceEnd)
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

    final class Sources {
        var opened: [[String]: SourceTrack] = [:]
    }
    struct Graph {
        let nodes: [CompositionProcessing]
        let inputs: [String: Input]
        let missing: [CompositionAudioReport.Missing]
        func stream(range: Plan.Samples, target: CompositionProcessing.Target, before: String? = nil,
                    prepared: PreparedState? = nil) -> Stream {
            Stream(range: range, nodes: nodes, inputs: inputs.mapValues {
                Input(source: $0.source, contexts: $0.contexts, intervals: $0.intervals)
            }, missing: missing, target: target, before: before, prepared: prepared)
        }
    }
    static func graph(_ plan: CompositionAudioPlan, forest: Bool = false,
                      sources: Sources) async throws -> Graph {
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
                    ["gain", "rnnoise"].contains(step.processor.type)
                else { throw invalid("Unsupported audio processing step.") }
                if step.processor.type == "gain" {
                guard let gain = step.processor.gain else { throw invalid("Missing gain.") }
                switch gain {
                case .constant(let value):
                    guard value.isFinite, value >= 0, value <= Double(Float.greatestFiniteMagnitude)
                    else { throw invalid("Only finite nonnegative float gain is supported.") }
                case .program(let program): try program.validate()
                }
                } else if step.processor.active == nil { throw invalid("Missing state activation spans.") }
                if let active = step.processor.active {
                    var end: Int64 = 0
                    for span in active {
                        guard span.start >= end, span.end > span.start,
                            span.end <= TimeSpan.maximumMicroseconds
                        else { throw invalid("Invalid gain activation spans.") }
                        end = span.end
                    }
                }
            }
        }
        guard (forest || used.count == nodes.count - 1),
            Set(nodes.filter { $0.target.kind == "clip" }.compactMap { $0.target.id })
                == Set(clipById.keys)
        else { throw invalid("Every audio clip and node must belong to the requested tree.") }
        let assets = Dictionary(grouping: plan.assets, by: { [$0.assetId, $0.streamId] })
        guard assets.values.allSatisfy({ $0.count == 1 }) else {
            throw invalid("Duplicate asset stream.")
        }
        var inputs: [String: Input] = [:]
        var missing: [CompositionAudioReport.Missing] = []
        for clip in plan.clips {
            try Task.checkCancellation()
            guard (clip.sampleRange.valid || (forest && clip.sampleRange.start == clip.sampleRange.end && clip.sampleRange.start >= 0)), clip.sampleRange.start >= plan.range.start,
                clip.sampleRange.end <= plan.range.end, ["preserve", "follow"].contains(clip.pitch)
            else { throw invalid("Invalid compiled clip sample bounds or pitch policy.") }
            guard clip.sampleRange.start >= (try clip.placement.startUs.sample(rate)),
                clip.sampleRange.end <= (try clip.placement.endUs.sample(rate)),
                nodes.contains(where: {
                    $0.target.kind == "track" && $0.target.id == clip.trackId
                        && $0.inputs.contains(.init(kind: "clip", id: clip.clipId))
                })
                    || (forest ? !used.contains(.init(kind: "clip", id: clip.clipId)) : nodes.last?.target == .init(kind: "clip", id: clip.clipId))
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
            if let existing = sources.opened[[assetId, streamId]] {
                source = existing
            } else {
                source = try await SourceTrack.open(
                    source: asset.path, streamId: streamId,
                    sourceOffsetUs: -asset.originUs,
                    available: [TimeSpan(startUs: 0, endUs: TimeSpan.maximumMicroseconds)])
                sources.opened[[assetId, streamId]] = source
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
            let required = clip.required ?? [clip.sampleRange]
            var requiredEnd = clip.sampleRange.start
            for span in required {
                guard span.valid, span.start >= requiredEnd, span.end <= clip.sampleRange.end else {
                    throw invalid("Required support must be ordered within clip bounds.")
                }
                requiredEnd = span.end
                var position = span.start
                for part in readable where part.end > position && part.start < span.end {
                    if position < part.start { absent.append(.init(start: position, end: min(part.start, span.end))) }
                    position = min(span.end, max(position, part.end))
                }
                if position < span.end { absent.append(.init(start: position, end: span.end)) }
            }
            missing.append(.init(clipId: clip.clipId, ranges: absent))
            inputs[clip.clipId] = Input(
                source: source, contexts: contexts, intervals: readable)
        }
        return Graph(nodes: nodes, inputs: inputs, missing: missing)
    }

    public static func open(_ plan: CompositionAudioPlan) async throws -> Stream {
        let sources = Sources()
        let prepared = try await prepareState(plan, sources: sources)
        let graph = try await graph(plan, sources: sources)
        return graph.stream(range: plan.range, target: graph.nodes.last!.target, prepared: prepared)
    }

    /// Prepares one bounded PCM source; neither the consumer nor a preview window owns its phase.
    public final class Stream: AudioPCMSource {
        public let format = AudioPCMFormat(sampleRate: rate, channels: 2, layout: .stereo)
        public private(set) var report: CompositionAudioReport?
        private let range: Plan.Samples
        private let nodes: [CompositionProcessing]
        private let inputs: [String: Input]
        private let missing: [CompositionAudioReport.Missing]
        private let target: CompositionProcessing.Target
        private let before: String?
        private let prepared: PreparedState?
        private var consumed = false

        init(
            range: Plan.Samples, nodes: [CompositionProcessing], inputs: [String: Input],
            missing: [CompositionAudioReport.Missing], target: CompositionProcessing.Target,
            before: String?, prepared: PreparedState?
        ) {
            self.range = range
            self.nodes = nodes
            self.inputs = inputs
            self.missing = missing
            self.target = target
            self.before = before
            self.prepared = prepared
        }
        public func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws {
            guard !consumed else { throw invalid("Composition PCM can only be consumed once.") }
            consumed = true
            let byTarget = Dictionary(uniqueKeysWithValues: nodes.enumerated().map { ($0.element.target, $0.offset) })
            guard let root = byTarget[target] else { throw invalid("Unknown audio view target.") }
            let endpoint: Int
            if let before {
                guard let index = nodes[root].steps.firstIndex(where: { $0.id == before }) else {
                    throw invalid("Unknown exclusive audio prefix endpoint.")
                }
                endpoint = index
            } else { endpoint = nodes[root].steps.count }
            let limits = nodes.indices.map { $0 == root ? endpoint : nodes[$0].steps.count }
            let children = nodes.map { $0.inputs.compactMap { byTarget[$0] } }
            // Index replacement changes once; each block visits only its needed routing subtree.
            typealias Event = (at: Int64, node: Int, step: Int, span: PreparedState.Span?)
            var events: [Event] = []
            var boundarySet = Set<Int64>()
            for (index, node) in nodes.enumerated() {
                for (stepIndex, step) in node.steps.prefix(limits[index]).enumerated() where step.enabled {
                    for span in prepared?.spans[step.id] ?? [] {
                        events.append((span.range.start, index, stepIndex, span))
                        events.append((span.range.end, index, stepIndex, nil))
                        boundarySet.insert(span.range.start)
                        boundarySet.insert(span.range.end)
                    }
                    if step.processor.type == "rnnoise" {
                        for span in step.processor.active ?? [] { boundarySet.insert(span.start); boundarySet.insert(span.end) }
                    }
                }
            }
            events.sort { a, b in a.at != b.at ? a.at < b.at : a.span == nil && b.span != nil }
            var eventIndex = 0
            var active = [Int: [Int: PreparedState.Span]]()
            var latest = [Int: (Int, PreparedState.Span)]()
            let boundaries = boundarySet.filter { $0 > range.start && $0 < range.end }.sorted()
            var boundaryIndex = 0
            // Processing buffers total at most eight MiB, independently of project duration or depth.
            let blockFrames = max(1, min(8192, 1_048_576 / nodes.count))
            var peak: Float = 0
            var clipped: Int64 = 0
            do {
                var position = range.start
                while position < range.end {
                    try Task.checkCancellation()
                    while boundaryIndex < boundaries.count && boundaries[boundaryIndex] <= position { boundaryIndex += 1 }
                    let end = min(range.end, boundaryIndex < boundaries.count ? boundaries[boundaryIndex] : range.end)
                    let count = Int(min(Int64(blockFrames), end - position))
                    while eventIndex < events.count && events[eventIndex].0 <= position {
                        let (_, node, step, span) = events[eventIndex]
                        active[node, default: [:]][step] = span
                        latest[node] = active[node]?.max(by: { $0.key < $1.key }).map { ($0.key, $0.value) }
                        eventIndex += 1
                    }
                    var chosen: [Int: (Int, PreparedState.Span)] = [:]
                    var needed = Set<Int>()
                    var pending = [root]
                    while let index = pending.popLast() {
                        guard needed.insert(index).inserted else { continue }
                        if let span = latest[index] {
                            chosen[index] = span
                        } else { pending.append(contentsOf: children[index]) }
                    }
                    var buffers: [Int: [Float]] = [:]
                    for index in nodes.indices where needed.contains(index) {
                        try Task.checkCancellation()
                        let node = nodes[index]
                        var samples: [Float]
                        let firstStep: Int
                        if let (step, span) = chosen[index] {
                            samples = try prepared!.read(span, position: position, count: count)
                            firstStep = step + 1
                        } else {
                            samples = [Float](repeating: 0, count: count * 2)
                            firstStep = 0
                            if node.target.kind == "clip", let id = node.target.id {
                                if let input = inputs[id] { try input.mix(into: &samples, position: position, count: count) }
                            } else {
                                var combined: [Float]?
                                for child in children[index] {
                                    guard let input = buffers.removeValue(forKey: child) else { continue }
                                    if combined == nil { combined = input }
                                    else { for sample in input.indices { combined![sample] += input[sample] } }
                                }
                                if let combined { samples = combined }
                            }
                        }
                        for step in node.steps[firstStep..<limits[index]] where step.enabled {
                            if step.processor.type == "gain" {
                                try applyGain(step.processor, to: &samples, position: position)
                            } else if step.processor.type == "rnnoise",
                                (step.processor.active ?? []).contains(where: { $0.start <= position && position < $0.end }) {
                                throw invalid("Active RNNoise has no prepared coverage.")
                            }
                        }
                        buffers[index] = samples
                    }
                    let samples = buffers[root] ?? [Float](repeating: 0, count: count * 2)
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
                    maximumPrerollFrames: max(inputs.values.map(\.maximumPreroll).max() ?? 0, prepared?.maximumPreroll ?? 0),
                    maximumTailFrames: max(inputs.values.map(\.maximumTail).max() ?? 0, prepared?.maximumTail ?? 0)),
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
