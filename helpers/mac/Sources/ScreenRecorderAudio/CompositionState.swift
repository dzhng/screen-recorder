import Foundation
import ScreenRecorderDenoise
import ScreenRecorderMedia

extension CompositionAudio {
    /// Identifies the compiled model and the complete fixed sample recipe, not a selectable quality preset.
    public static let rnnoiseImplementation = "rnnoise-70f1d256-d6021b7697677c4d2274c912975e143765552b0e6f25500aa660fdb4a9849be5-f480-s32768-flush2-delay960-independent-channels-v2"

    final class PreparedState {
        struct Span {
            let range: Plan.Samples
            let offsets: (UInt64, UInt64)
        }
        let directory: URL
        let input: FileHandle
        let output: FileHandle
        var spans: [String: [Span]] = [:]
        var maximumPreroll: Int64 = 0
        var maximumTail: Int64 = 0
        init(parent: URL) throws {
            directory = parent.appendingPathComponent(".rnnoise-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
            do {
                let a = directory.appendingPathComponent("input.f32")
                let b = directory.appendingPathComponent("output.f32")
                guard FileManager.default.createFile(atPath: a.path, contents: nil),
                    FileManager.default.createFile(atPath: b.path, contents: nil) else {
                    throw invalid("Cannot create state scratch files.")
                }
                input = try FileHandle(forUpdating: a)
                output = try FileHandle(forUpdating: b)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                throw error
            }
        }
        deinit {
            try? input.close()
            try? output.close()
            try? FileManager.default.removeItem(at: directory)
        }
        func read(_ span: Span, position: Int64, count: Int) throws -> [Float] {
            // FileHandle's Objective-C temporaries must drain per chunk, not per full program.
            try autoreleasepool {
                guard position >= span.range.start, position + Int64(count) <= span.range.end else {
                    throw invalid("Prepared state read exceeds its component.")
                }
                var result = [Float](repeating: 0, count: count * 2)
                for (channel, offset) in [span.offsets.0, span.offsets.1].enumerated() {
                    try output.seek(toOffset: offset + UInt64(position - span.range.start) * 4)
                    let data = try output.read(upToCount: count * 4) ?? Data()
                    guard data.count == count * 4 else { throw invalid("Prepared state PCM is truncated.") }
                    data.withUnsafeBytes { bytes in
                        for index in 0..<count {
                            result[index * 2 + channel] = bytes.loadUnaligned(fromByteOffset: index * 4, as: Float.self)
                        }
                    }
                }
                return result
            }
        }
    }

    static func prepareState(_ plan: Plan, sources: Sources) async throws -> PreparedState? {
        guard let state = plan.state else { return nil }
        guard state.implementationId == rnnoiseImplementation, !state.domains.isEmpty,
            state.domains.count <= 20_000, state.domains.reduce(0, { $0 + $1.members.count }) <= 20_000, state.formats.count <= 10_000 else {
            throw invalid("Unknown RNNoise implementation or invalid state plan bounds.")
        }
        let nodes = Dictionary(grouping: state.processing, by: \.target)
        guard nodes.values.allSatisfy({ $0.count == 1 }) else { throw invalid("Duplicate state target.") }
        var memberships: [String: [Plan.Samples]] = [:]
        for (index, domain) in state.domains.enumerated() {
            try Task.checkCancellation()
            guard domain.sampleRange.start >= 0, domain.sampleRange.end >= domain.sampleRange.start,
                domain.sampleRange.end <= TimeSpan.maximumMicroseconds, !domain.members.isEmpty,
                domain.dependencies.allSatisfy({ $0 >= 0 && $0 < state.domains.count && $0 != index }),
                Set(domain.dependencies).count == domain.dependencies.count else {
                throw invalid("State components must have bounded samples and valid dependencies.")
            }
            var position = domain.sampleRange.start
            for member in domain.members {
                guard member.sampleRange.start == position, member.sampleRange.end >= position,
                    member.sampleRange.end <= domain.sampleRange.end,
                    let node = nodes[member.target]?.first,
                    let step = node.steps.first(where: { $0.id == member.stepId }),
                    step.enabled, step.processor.type == "rnnoise" else {
                    throw invalid("State members must cover their component with owned RNNoise endpoints.")
                }
                position = member.sampleRange.end
                memberships[member.stepId, default: []].append(member.sampleRange)
            }
            guard position == domain.sampleRange.end else { throw invalid("State members do not cover their component.") }
        }
        var byStep: [String: [(Int, Plan.Samples)]] = [:]
        for (index, domain) in state.domains.enumerated() {
            try Task.checkCancellation()
            for member in domain.members { byStep[member.stepId, default: []].append((index, member.sampleRange)) }
        }
        for node in state.processing {
            for step in node.steps where step.enabled && step.processor.type == "rnnoise" {
                let expected = (byStep[step.id] ?? []).map { $0.1 }.filter { $0.end > $0.start }.sorted { $0.start < $1.start }
                let actual = (step.processor.active ?? []).map { Plan.Samples(start: $0.start, end: $0.end) }
                guard expected == actual else { throw invalid("State activation differs from component membership.") }
            }
        }
        var order: [Int] = []
        var status = [UInt8](repeating: 0, count: state.domains.count)
        for start in state.domains.indices where status[start] == 0 {
            var pending = [(start, 0)]
            status[start] = 1
            while let (index, next) = pending.last {
                try Task.checkCancellation()
                if next == state.domains[index].dependencies.count {
                    status[index] = 2
                    order.append(index)
                    pending.removeLast()
                } else {
                    let dependency = state.domains[index].dependencies[next]
                    pending[pending.count - 1].1 += 1
                    guard status[dependency] != 1 else { throw invalid("State dependency cycle.") }
                    if status[dependency] == 0 { status[dependency] = 1; pending.append((dependency, 0)) }
                }
            }
        }
        for ranges in memberships.values {
            var previous: Int64 = 0
            for range in ranges.sorted(by: { $0.start < $1.start }) {
                guard range.start >= previous else { throw invalid("Overlapping state membership.") }
                previous = range.end
            }
        }
        // The forest is opened once. Every view clones decoder cursors, retaining one validated
        // source binding and the compiler's existing resampling-context policy.
        let bounds = Plan.Samples(start: 0, end: max(1, state.domains.map(\.sampleRange.end).max() ?? 1))
        let prerequisite = Plan(output: plan.output, range: bounds, clips: state.clips,
            processing: state.processing, assets: plan.assets)
        let graph = try await graph(prerequisite, forest: true, sources: sources)
        guard graph.missing.allSatisfy({ $0.ranges.isEmpty }) else {
            throw NativeFailure("NOT_READY", "Selected RNNoise input has unavailable source support.")
        }
        var formats: [[String]: Plan.State.Format] = [:]
        for format in state.formats {
            let key = [format.assetId, format.streamId]
            if let previous = formats[key], previous.channels != format.channels || previous.sampleRate != format.sampleRate {
                throw invalid("Conflicting source format provenance.")
            }
            formats[key] = format
        }
        for (key, source) in sources.opened {
            guard let format = formats[key], (source.channels == 1 || source.channels == 2),
                format.channels == source.channels, format.sampleRate == source.sampleRate else {
                throw NativeFailure("NOT_READY", "RNNoise requires verified mono or stereo provenance matching the opened stream.")
            }
        }
        let prepared = try PreparedState(parent: URL(fileURLWithPath: plan.output).deletingLastPathComponent())
        for index in order {
            let domain = state.domains[index]
            try Task.checkCancellation()
            let count = domain.sampleRange.end - domain.sampleRange.start
            if count == 0 { continue }
            try prepared.input.truncate(atOffset: 0)
            try prepared.input.seek(toOffset: 0)
            var received: Int64 = 0
            for member in domain.members where member.sampleRange.end > member.sampleRange.start {
                let stream = graph.stream(range: member.sampleRange, target: member.target,
                    before: member.stepId, prepared: prepared)
                try await stream.consume { block in
                    try block.samples.withUnsafeBytes { try prepared.input.write(contentsOf: $0) }
                    received += Int64(block.frameCount)
                }
                prepared.maximumPreroll = max(prepared.maximumPreroll, stream.report?.decoderContext.maximumPrerollFrames ?? 0)
                prepared.maximumTail = max(prepared.maximumTail, stream.report?.decoderContext.maximumTailFrames ?? 0)
            }
            guard received == count, try prepared.input.offset() == UInt64(count) * 8 else {
                throw invalid("State prefix sample count differs from component.")
            }
            var offsets: [UInt64] = []
            // The rendition has two lanes, each with its own instance of the fixed mono algorithm;
            // no component is exposed if either lane fails or cancellation interrupts the pair.
            for channel in 0..<2 {
                try Task.checkCancellation()
                try prepared.input.seek(toOffset: 0)
                let offset = try prepared.output.seekToEnd()
                var written: Int64 = 0
                try RNNoiseProcessor.process(sampleCount: count, sampleRate: rate, channels: 1, read: { buffer in
                    try autoreleasepool {
                        let data = try prepared.input.read(upToCount: buffer.count * 8) ?? Data()
                        guard data.count % 8 == 0 else { throw invalid("Unaligned stereo state input PCM.") }
                        data.withUnsafeBytes { bytes in
                            for index in 0..<(bytes.count / 8) {
                                buffer[index] = bytes.loadUnaligned(fromByteOffset: index * 8 + channel * 4, as: Float.self)
                            }
                        }
                        return data.count / 8
                    }
                }, write: { buffer in
                    try autoreleasepool { try prepared.output.write(contentsOf: Data(buffer: buffer)) }
                    written += Int64(buffer.count)
                }, checkCancellation: { try Task.checkCancellation() })
                guard written == count, try prepared.output.offset() == offset + UInt64(count) * 4 else {
                    throw invalid("State lane output count differs from component.")
                }
                offsets.append(offset)
            }
            for member in domain.members where member.sampleRange.end > member.sampleRange.start {
                let displacement = UInt64(member.sampleRange.start - domain.sampleRange.start) * 4
                prepared.spans[member.stepId, default: []].append(.init(range: member.sampleRange,
                    offsets: (offsets[0] + displacement, offsets[1] + displacement)))
            }
        }
        return prepared
    }
}
